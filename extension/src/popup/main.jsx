import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Brain,
  ChevronRight,
  Clock3,
  ExternalLink,
  LogIn,
  LogOut,
  Plus,
  Settings2,
  Sparkles,
  Square,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";
import "./style.css";

const DEFAULT_API = "http://localhost:5000/api";

const api = (path, opts = {}) =>
  chrome.storage.local
    .get(["token", "apiBase"])
    .then((s) => {
      const base = s.apiBase || DEFAULT_API;

      return fetch(base + path, {
        ...opts,
        headers: {
          "Content-Type": "application/json",
          ...(s.token
            ? { Authorization: `Bearer ${s.token}` }
            : {}),
          ...(opts.headers || {}),
        },
      });
    })
    .then(async (r) => {
      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw Error(d.message || "Request failed");
      }

      return d;
    });

function App() {
  const [mode, setMode] = useState("home");
  const [user, setUser] = useState(null);
  const [task, setTask] = useState("");
  const [action, setAction] = useState(null);

  // General API/loading lock.
  const [loading, setLoading] = useState(false);

  // AI request lock.
  // Only ONE AI request can run at a time.
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState("");

  const [err, setErr] = useState("");

  const [auth, setAuth] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [isRegister, setIsRegister] = useState(false);

  // Focus timer state.
  const [mins, setMins] = useState(25);
  const [remain, setRemain] = useState(0);
  const [running, setRunning] = useState(false);
  const [focusId, setFocusId] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [usage, setUsage] = useState(null);

  const [blocked, setBlocked] = useState(
    "youtube.com, instagram.com, reddit.com, x.com, facebook.com",
  );

  useEffect(() => {
    chrome.storage.local
      .get([
        "user",
        "focusActive",
        "focusEnd",
        "focusTask",
        "blockedDomains",
      ])
      .then((s) => {
        setUser(s.user || null);

        if (s.focusActive && s.focusEnd) {
          const remaining = Math.max(
            0,
            Math.ceil((s.focusEnd - Date.now()) / 1000),
          );

          setRunning(remaining > 0);
          setRemain(remaining);
          setTask(s.focusTask || "");

          // If saved focus session already expired.
          if (remaining <= 0) {
            chrome.storage.local.set({
              focusActive: false,
              focusEnd: null,
            });
          }
        }
      });

    api("/tasks")
      .then(setTasks)
      .catch(() => {});

    api("/ai/usage")
      .then(setUsage)
      .catch(() => {});

    chrome.storage.local.get(["blockedDomains"]).then((s) => {
      if (s.blockedDomains?.length) {
        setBlocked(s.blockedDomains.join(", "));
      }
    });
  }, []);

  // Countdown timer.
  useEffect(() => {
    if (!running) return;

    const id = setInterval(() => {
      setRemain((x) => {
        if (x <= 1) {
          clearInterval(id);

          setRunning(false);
          setFocusId(null);

          // Timer has finished, so AI focus tools become unavailable.
          setMode("home");

          chrome.storage.local.set({
            focusActive: false,
            focusEnd: null,
          });

          return 0;
        }

        return x - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [running]);

  // ---------------------------------------------------------
  // AUTH
  // ---------------------------------------------------------

  const login = async (e) => {
    e.preventDefault();

    if (loading || aiLoading) return;

    setLoading(true);
    setErr("");

    try {
      const d = await api(
        "/auth/" + (isRegister ? "register" : "login"),
        {
          method: "POST",
          body: JSON.stringify(auth),
        },
      );

      await chrome.storage.local.set({
        token: d.token,
        user: d.user,
      });

      setUser(d.user);
      setMode("home");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // AI LOCK
  // ---------------------------------------------------------

  /*
   * One AI request at a time.
   *
   * Protection:
   * - First click starts request.
   * - Second click while request is running is ignored.
   * - Every AI button receives aiLoading=true.
   * - Buttons become active again only after success/error.
   */
  const runAI = async (name, requestFn) => {
    if (aiLoading) {
      return null;
    }

    setAiLoading(true);
    setAiAction(name);
    setErr("");

    try {
      return await requestFn();
    } catch (e) {
      setErr(e.message);
      return null;
    } finally {
      setAiLoading(false);
      setAiAction("");
    }
  };

  const refreshUsage = async () => {
    try {
      const u = await api("/ai/usage");
      setUsage(u);
    } catch {
      // Usage refresh shouldn't break the AI response.
    }
  };

  // ---------------------------------------------------------
  // NEXT TINY ACTION
  // ---------------------------------------------------------

  // This one remains available before timer starts.
  const next = async () => {
    if (!task.trim()) {
      setErr("Enter what you're working on first.");
      return;
    }

    await runAI("next-action", async () => {
      const d = await api("/ai/next-action", {
        method: "POST",
        body: JSON.stringify({
          task: task.trim(),
        }),
      });

      setAction(d.result);
      await refreshUsage();

      return d;
    });
  };

  // ---------------------------------------------------------
  // BREAK IT DOWN
  // ---------------------------------------------------------

  const breakdown = async () => {
    // HARD protection.
    // Even if someone triggers the function manually,
    // it cannot call the API without an active timer.
    if (!running) {
      setErr("Start a focus session first.");
      return;
    }

    if (!task.trim()) {
      setErr("Enter what you're working on first.");
      return;
    }

    await runAI("breakdown", async () => {
      const d = await api("/ai/task-breakdown", {
        method: "POST",
        body: JSON.stringify({
          task: task.trim(),
          minutes: mins,
        }),
      });

      setAction(d.result);
      await refreshUsage();

      return d;
    });
  };

  // ---------------------------------------------------------
  // I'M STUCK
  // ---------------------------------------------------------

  const stuck = async (blocker) => {
    // HARD protection.
    if (!running) {
      setErr("Start a focus session first.");
      setMode("home");
      return;
    }

    if (!task.trim()) {
      setErr("Enter what you're working on first.");
      return;
    }

    await runAI("stuck", async () => {
      const d = await api("/ai/stuck", {
        method: "POST",
        body: JSON.stringify({
          task: task.trim(),
          blocker,
        }),
      });

      setAction(d.result);
      await refreshUsage();

      // Return to the main popup after receiving the answer.
      setMode("home");

      return d;
    });
  };

  // ---------------------------------------------------------
  // SUMMARIZE PAGE
  // ---------------------------------------------------------

  const summarize = async () => {
    // HARD protection.
    if (!running) {
      setErr("Start a focus session first.");
      return;
    }

    await runAI("summarize", async () => {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      const tab = tabs?.[0];

      if (!tab?.id) {
        throw Error("Could not find the active tab.");
      }

      let data;

      try {
        data = await chrome.tabs.sendMessage(tab.id, {
          type: "GET_PAGE_TEXT",
        });
      } catch {
        throw Error(
          "Could not read this page. Refresh the webpage and try again.",
        );
      }

      if (!data?.text?.trim()) {
        throw Error("No readable page text found.");
      }

      const d = await api("/ai/summarize", {
        method: "POST",
        body: JSON.stringify({
          text: data.text,
        }),
      });

      setAction(d.result);
      await refreshUsage();

      return d;
    });
  };

  // ---------------------------------------------------------
  // FOCUS TIMER
  // ---------------------------------------------------------

  const start = async () => {
    if (aiLoading || loading) return;

    setErr("");
    setLoading(true);

    try {
      const s = await api("/focus/start", {
        method: "POST",
        body: JSON.stringify({
          duration: mins,
        }),
      });

      setFocusId(s._id);

      const end = Date.now() + mins * 60000;

      await chrome.storage.local.set({
        focusActive: true,
        focusTask: task || "Focus session",
        focusEnd: end,
      });

      try {
        await chrome.runtime.sendMessage({
          type: "SET_FOCUS",
          task: task || "Focus session",
          end,
        });
      } catch {}

      setRemain(mins * 60);
      setRunning(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const stop = async (completed = false) => {
    if (loading) return;

    setLoading(true);

    try {
      if (focusId) {
        await api("/focus/end/" + focusId, {
          method: "POST",
          body: JSON.stringify({
            completed,
            interrupted: !completed,
          }),
        });
      }
    } catch {
      // Still stop local timer if API fails.
    }

    try {
      await chrome.runtime.sendMessage({
        type: "STOP_FOCUS",
      });
    } catch {}

    await chrome.storage.local.set({
      focusActive: false,
      focusEnd: null,
    });

    setRunning(false);
    setRemain(0);
    setFocusId(null);

    // Timer ended manually.
    // Disable AI focus tools again.
    setMode("home");

    setLoading(false);
  };

  // ---------------------------------------------------------
  // TASKS
  // ---------------------------------------------------------

  const addTask = async () => {
    if (!task.trim() || loading || aiLoading) return;

    setLoading(true);
    setErr("");

    try {
      const t = await api("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: task.trim(),
          estimatedMinutes: mins,
          source: "extension",
        }),
      });

      setTasks((x) => [t, ...x]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const complete = async (id) => {
    if (loading || aiLoading) return;

    setLoading(true);
    setErr("");

    try {
      const t = await api("/tasks/" + id, {
        method: "PATCH",
        body: JSON.stringify({
          completed: true,
        }),
      });

      setTasks((x) =>
        x.map((a) => (a._id === id ? t : a)),
      );
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // SETTINGS
  // ---------------------------------------------------------

  const saveSettings = async () => {
    if (loading || aiLoading) return;

    const domains = blocked
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    setLoading(true);
    setErr("");

    try {
      await chrome.storage.local.set({
        blockedDomains: domains,
      });

      await api("/settings", {
        method: "PUT",
        body: JSON.stringify({
          blockedDomains: domains,
        }),
      });

      setMode("home");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (aiLoading || loading) return;

    await chrome.storage.local.remove([
      "token",
      "user",
    ]);

    setUser(null);
    setMode("login");
  };

  // ---------------------------------------------------------
  // READABLE AI RESULT
  // ---------------------------------------------------------

  const renderAction = useMemo(() => {
    if (!action) return null;

    let value = action;

    // AI/provider might return a JSON string.
    if (typeof value === "string") {
      const trimmed = value.trim();

      if (
        (trimmed.startsWith("{") &&
          trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") &&
          trimmed.endsWith("]"))
      ) {
        try {
          value = JSON.parse(trimmed);
        } catch {
          // Keep original string.
        }
      }
    }

    // NEXT ACTION
    if (
      value &&
      !Array.isArray(value) &&
      typeof value === "object" &&
      "nextAction" in value
    ) {
      return (
        <div className="aiReadable">
          <div className="aiMainText">
            {value.nextAction}
          </div>

          {value.estimatedMinutes && (
            <div className="aiMeta">
              <Clock3 size={14} />
              About {value.estimatedMinutes} minutes
            </div>
          )}

          {value.encouragement && (
            <div className="aiEncouragement">
              {value.encouragement}
            </div>
          )}
        </div>
      );
    }

    // I'M STUCK
    if (
      value &&
      !Array.isArray(value) &&
      typeof value === "object" &&
      "tinyAction" in value
    ) {
      return (
        <div className="aiReadable">
          <div className="aiMainText">
            {value.tinyAction}
          </div>

          {value.minutes && (
            <div className="aiMeta">
              <Clock3 size={14} />
              About {value.minutes} minutes
            </div>
          )}

          {value.reassurance && (
            <div className="aiEncouragement">
              {value.reassurance}
            </div>
          )}
        </div>
      );
    }

    // BREAKDOWN
    if (
      value &&
      !Array.isArray(value) &&
      typeof value === "object" &&
      Array.isArray(value.steps)
    ) {
      return (
        <div className="aiSteps">
          {value.steps.map((step, index) => (
            <div className="aiStep" key={index}>
              <div className="aiStepNumber">
                {index + 1}
              </div>

              <div className="aiStepBody">
                <strong>
                  {step.title || `Step ${index + 1}`}
                </strong>

                {step.description && (
                  <p>{step.description}</p>
                )}

                {step.estimatedMinutes && (
                  <span className="aiStepTime">
                    <Clock3 size={13} />
                    {step.estimatedMinutes} min
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // PAGE SUMMARY
    if (
      value &&
      !Array.isArray(value) &&
      typeof value === "object" &&
      ("summary" in value || "keyPoints" in value)
    ) {
      return (
        <div className="aiReadable">
          {value.summary && (
            <div className="summaryBlock">
              <strong>Summary</strong>
              <p>{value.summary}</p>
            </div>
          )}

          {Array.isArray(value.keyPoints) &&
            value.keyPoints.length > 0 && (
              <div className="summaryBlock">
                <strong>Key points</strong>

                <ul>
                  {value.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

          {value.takeaway && (
            <div className="summaryBlock takeaway">
              <strong>What to remember</strong>
              <p>{value.takeaway}</p>
            </div>
          )}

          {value.readingMinutes && (
            <div className="aiMeta">
              <Clock3 size={14} />
              Reading time: about {value.readingMinutes} min
            </div>
          )}
        </div>
      );
    }

    // SIMPLIFY
    if (
      value &&
      !Array.isArray(value) &&
      typeof value === "object" &&
      ("explanation" in value || "example" in value)
    ) {
      return (
        <div className="aiReadable">
          {value.explanation && (
            <div className="summaryBlock">
              <strong>Simple explanation</strong>
              <p>{value.explanation}</p>
            </div>
          )}

          {value.example && (
            <div className="summaryBlock">
              <strong>Example</strong>
              <p>{value.example}</p>
            </div>
          )}

          {value.takeaway && (
            <div className="summaryBlock takeaway">
              <strong>Takeaway</strong>
              <p>{value.takeaway}</p>
            </div>
          )}
        </div>
      );
    }

    // Fallback.
    return (
      <div className="aiReadable">
        {typeof value === "string"
          ? value
          : JSON.stringify(value, null, 2)}
      </div>
    );
  }, [action]);

  // ---------------------------------------------------------
  // AUTH SCREEN
  // ---------------------------------------------------------

  if (!user) {
    return (
      <Auth
        mode={mode}
        setMode={setMode}
        auth={auth}
        setAuth={setAuth}
        isRegister={isRegister}
        setIsRegister={setIsRegister}
        login={login}
        err={err}
        loading={loading}
      />
    );
  }

  // ---------------------------------------------------------
  // MAIN UI
  // ---------------------------------------------------------

  return (
    <main>
      <header>
        <div className="brand">
          <div className="brandIcon">
            <Brain size={20} />
          </div>

          <div>
            <b>FocusFlow</b>
            <small>tiny steps. calmer focus.</small>
          </div>
        </div>

        <button
          className="iconBtn"
          disabled={loading || aiLoading}
          onClick={() =>
            setMode(
              mode === "settings"
                ? "home"
                : "settings",
            )
          }
          title="Settings"
        >
          <Settings2 size={18} />
        </button>
      </header>

      {mode === "settings" ? (
        <Settings
          blocked={blocked}
          setBlocked={setBlocked}
          save={saveSettings}
          logout={logout}
          disabled={loading || aiLoading}
        />
      ) : mode === "stuck" ? (
        <Stuck
          task={task}
          on={stuck}
          back={() => setMode("home")}
          loading={aiLoading}
          activeAction={aiAction}
          running={running}
        />
      ) : (
        <>
          {/* ---------------------------------------------
              CURRENT TASK
          --------------------------------------------- */}
          <section className="heroCard">
            <div className="eyebrow">RIGHT NOW</div>

            <h1>What are you working on?</h1>

            <textarea
              value={task}
              disabled={loading || aiLoading}
              onChange={(e) =>
                setTask(e.target.value)
              }
              placeholder="e.g. Prepare DBMS for tomorrow's exam"
            />

            <div className="buttonRow">
              <button
                className="primary"
                onClick={next}
                disabled={
                  loading ||
                  aiLoading ||
                  !task.trim()
                }
              >
                {aiLoading &&
                aiAction === "next-action"
                  ? "Thinking…"
                  : "Give me my next tiny step"}

                <ChevronRight size={17} />
              </button>
            </div>
          </section>

          {/* ---------------------------------------------
              AI RESULT
          --------------------------------------------- */}
          {action && (
            <section className="resultCard">
              <div className="resultHeader">
                <span>
                  <Sparkles size={15} />
                  AI guidance
                </span>

                <button
                  disabled={aiLoading}
                  onClick={() => setAction(null)}
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>

              {renderAction}
            </section>
          )}

          {/* ---------------------------------------------
              ERROR
          --------------------------------------------- */}
          {err && (
            <div className="error">
              <TriangleAlert size={15} />
              {err}
            </div>
          )}

          {/* ---------------------------------------------
              AI TOOLS
          --------------------------------------------- */}
          <section className="tools">
            {/* BREAK IT DOWN */}
            <button
              onClick={breakdown}
              disabled={
                !running ||
                loading ||
                aiLoading ||
                !task.trim()
              }
              title={
                !running
                  ? "Start a focus session first"
                  : "Break your task into small steps"
              }
            >
              <div>
                <Sparkles size={17} />

                <span>
                  {aiLoading &&
                  aiAction === "breakdown"
                    ? "Breaking it down..."
                    : "Break it down"}
                </span>
              </div>

              <ChevronRight size={16} />
            </button>

            {/* I'M STUCK */}
            <button
              onClick={() => {
                if (!running) {
                  setErr(
                    "Start a focus session first.",
                  );
                  return;
                }

                setMode("stuck");
              }}
              disabled={
                !running ||
                loading ||
                aiLoading ||
                !task.trim()
              }
              title={
                !running
                  ? "Start a focus session first"
                  : "Get help when you're stuck"
              }
            >
              <div>
                <span className="emoji">🆘</span>

                <span>
                  {aiLoading &&
                  aiAction === "stuck"
                    ? "Helping..."
                    : "I'm stuck"}
                </span>
              </div>

              <ChevronRight size={16} />
            </button>

            {/* SUMMARIZE PAGE */}
            <button
              onClick={summarize}
              disabled={
                !running ||
                loading ||
                aiLoading
              }
              title={
                !running
                  ? "Start a focus session first"
                  : "Summarize the current page"
              }
            >
              <div>
                <ExternalLink size={17} />

                <span>
                  {aiLoading &&
                  aiAction === "summarize"
                    ? "Summarizing..."
                    : "Summarize this page"}
                </span>
              </div>

              <ChevronRight size={16} />
            </button>
          </section>

          {/* LOCK MESSAGE */}
          {!running && (
            <div className="aiLoading">
              <Timer size={15} />
              Start a focus session to unlock
              these tools.
            </div>
          )}

          {/* AI REQUEST MESSAGE */}
          {aiLoading && (
            <div className="aiLoading">
              <Sparkles size={15} />
              AI is working. Please wait...
            </div>
          )}

          {/* ---------------------------------------------
              FOCUS TIMER
          --------------------------------------------- */}
          <section className="timerCard">
            <div className="timerTop">
              <span>
                <Timer size={16} />
                Focus timer
              </span>

              {running && (
                <strong>
                  {String(
                    Math.floor(remain / 60),
                  ).padStart(2, "0")}
                  :
                  {String(remain % 60).padStart(
                    2,
                    "0",
                  )}
                </strong>
              )}
            </div>

            <div className="timerOptions">
              {[10, 15, 25, 45].map((n) => (
                <button
                  key={n}
                  className={
                    mins === n ? "selected" : ""
                  }
                  disabled={
                    running ||
                    loading ||
                    aiLoading
                  }
                  onClick={() => setMins(n)}
                >
                  {n}m
                </button>
              ))}
            </div>

            {running ? (
              <div className="timerActions">
                <button
                  className="secondary"
                  onClick={() => stop(false)}
                  disabled={loading || aiLoading}
                >
                  <Square size={14} />
                  End
                </button>

                <button
                  className="success"
                  onClick={() => stop(true)}
                  disabled={loading || aiLoading}
                >
                  Complete session
                </button>
              </div>
            ) : (
              <button
                className="primary wide"
                onClick={start}
                disabled={
                  loading ||
                  aiLoading ||
                  !task.trim()
                }
              >
                <Clock3 size={16} />
                Start {mins} min
              </button>
            )}
          </section>

          {/* ---------------------------------------------
              TASKS
          --------------------------------------------- */}
          <section className="tasks">
            <div className="sectionTitle">
              <span>Quick tasks</span>

              <button
                onClick={addTask}
                disabled={
                  loading || aiLoading
                }
              >
                <Plus size={15} />
                Save current
              </button>
            </div>

            {tasks.slice(0, 4).map((t) => (
              <div
                className="taskRow"
                key={t._id}
              >
                <button
                  className="check"
                  disabled={
                    loading || aiLoading
                  }
                  onClick={() =>
                    !t.completed &&
                    complete(t._id)
                  }
                >
                  {t.completed ? "✓" : ""}
                </button>

                <span
                  className={
                    t.completed
                      ? "done"
                      : ""
                  }
                >
                  {t.title}
                </span>
              </div>
            ))}

            {!tasks.length && (
              <p className="muted">
                Save the current task to keep
                it here.
              </p>
            )}
          </section>

          {/* ---------------------------------------------
              FOOTER
          --------------------------------------------- */}
          <footer>
            <span>
              AI today:{" "}
              {usage
                ? `${usage.used}/${usage.limit}`
                : "—"}
            </span>

            <button
              disabled={loading || aiLoading}
              onClick={() =>
                window.open(
                  "http://localhost:5173",
                  "_blank",
                )
              }
            >
              Dashboard
            </button>
          </footer>
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------
// AUTH COMPONENT
// ---------------------------------------------------------

function Auth({
  mode,
  setMode,
  auth,
  setAuth,
  isRegister,
  setIsRegister,
  login,
  err,
  loading,
}) {
  return (
    <main>
      <section className="auth">
        <div className="brand center">
          <div className="brandIcon">
            <Brain size={22} />
          </div>

          <div>
            <b>FocusFlow</b>
            <small>
              ADHD-friendly focus companion
            </small>
          </div>
        </div>

        <h1>
          {isRegister
            ? "Create your account"
            : "Welcome back"}
        </h1>

        <p className="muted">
          Turn overwhelm into one tiny action.
        </p>

        <form onSubmit={login}>
          {isRegister && (
            <input
              value={auth.name}
              disabled={loading}
              onChange={(e) =>
                setAuth({
                  ...auth,
                  name: e.target.value,
                })
              }
              placeholder="Name"
            />
          )}

          <input
            type="email"
            value={auth.email}
            disabled={loading}
            onChange={(e) =>
              setAuth({
                ...auth,
                email: e.target.value,
              })
            }
            placeholder="Email"
          />

          <input
            type="password"
            value={auth.password}
            disabled={loading}
            onChange={(e) =>
              setAuth({
                ...auth,
                password: e.target.value,
              })
            }
            placeholder="Password (6+ characters)"
          />

          {err && (
            <div className="error">
              {err}
            </div>
          )}

          <button
            className="primary wide"
            type="submit"
            disabled={loading}
          >
            <LogIn size={16} />

            {loading
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        <button
          className="linkBtn"
          disabled={loading}
          onClick={() => {
            setErr("");
            setIsRegister(!isRegister);
          }}
        >
          {isRegister
            ? "Already have an account? Log in"
            : "New here? Create an account"}
        </button>

        <p className="tiny">
          Your data stays in your FocusFlow
          account. AI keys are never stored in
          the extension.
        </p>
      </section>
    </main>
  );
}

// ---------------------------------------------------------
// I'M STUCK
// ---------------------------------------------------------

function Stuck({
  task,
  on,
  back,
  loading,
  activeAction,
  running,
}) {
  const opts = [
    "I don’t know where to start",
    "This feels too difficult",
    "I don’t understand the task",
    "I’m distracted",
    "I keep procrastinating",
  ];

  return (
    <main>
      <header>
        <button
          className="iconBtn"
          onClick={back}
          disabled={loading}
        >
          ←
        </button>

        <div>
          <b>I’m stuck</b>
          <small>make the next step smaller</small>
        </div>
      </header>

      {!running ? (
        <section className="stuck">
          <div className="error">
            <TriangleAlert size={15} />
            Start a focus session first.
          </div>

          <button
            className="primary wide"
            onClick={back}
          >
            Back to focus session
          </button>
        </section>
      ) : (
        <section className="stuck">
          <p>What’s blocking you right now?</p>

          {opts.map((o) => (
            <button
              key={o}
              className="choice"
              disabled={loading}
              onClick={() => on(o)}
            >
              <span>
                {loading &&
                activeAction === "stuck"
                  ? "Helping..."
                  : o}
              </span>

              <ChevronRight size={15} />
            </button>
          ))}

          {loading && (
            <div className="aiLoading">
              <Sparkles size={15} />
              AI is working. Please wait...
            </div>
          )}
        </section>
      )}
    </main>
  );
}

// ---------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------

function Settings({
  blocked,
  setBlocked,
  save,
  logout,
  disabled,
}) {
  return (
    <main>
      <header>
        <div>
          <b>Settings</b>
          <small>Keep FocusFlow gentle.</small>
        </div>
      </header>

      <section className="settings">
        <label>
          Distracting domains

          <textarea
            value={blocked}
            disabled={disabled}
            onChange={(e) =>
              setBlocked(e.target.value)
            }
          />
        </label>

        <p className="tiny">
          Used only during an active focus
          session. This is a gentle nudge, not a
          blocker.
        </p>

        <button
          className="primary wide"
          onClick={save}
          disabled={disabled}
        >
          Save settings
        </button>

        <button
          className="danger wide"
          onClick={logout}
          disabled={disabled}
        >
          <LogOut size={15} />
          Log out
        </button>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <App />,
);
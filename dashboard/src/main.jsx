import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Brain,
  CheckCircle2,
  Clock3,
  LogOut,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import "./style.css";
const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
async function api(path, opts = {}) {
  const token = localStorage.getItem("token");
  const r = await fetch(API + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.message || "Request failed");
  return d;
}
function App() {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user") || "null"),
  );
  const [d, setD] = useState(null);
  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [login, setLogin] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  useEffect(() => {
    if (user) load();
  }, [user]);
  async function load() {
    try {
      const [x, y] = await Promise.all([api("/dashboard"), api("/tasks")]);
      setD(x);
      setTasks(y);
    } catch (e) {
      setErr(e.message);
    }
  }
  async function auth(e) {
    e.preventDefault();
    try {
      const x = await api("/auth/" + (login ? "login" : "register"), {
        method: "POST",
        body: JSON.stringify(form),
      });
      localStorage.setItem("token", x.token);
      localStorage.setItem("user", JSON.stringify(x.user));
      setUser(x.user);
    } catch (e) {
      setErr(e.message);
    }
  }
  async function add() {
    if (!task.trim()) return;
    setLoading(true);
    try {
      await api("/tasks", {
        method: "POST",
        body: JSON.stringify({ title: task }),
      });
      setTask("");
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function complete(id) {
    await api("/tasks/" + id, {
      method: "PATCH",
      body: JSON.stringify({ completed: true }),
    });
    load();
  }
  if (!user)
    return (
      <main className="authPage">
        <form className="authCard" onSubmit={auth}>
          <div className="brand">
            <div className="icon">
              <Brain />
            </div>
            <div>
              <b>FocusFlow AI</b>
              <small>ADHD-friendly focus companion</small>
            </div>
          </div>
          <h1>{login ? "Welcome back" : "Start your calmer workflow"}</h1>
          {!login && (
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          )}
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {err && (
            <div className="error">
              <TriangleAlert size={16} />
              {err}
            </div>
          )}
          <button className="primary">
            {login ? "Log in" : "Create account"}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => setLogin(!login)}
          >
            {login ? "Create an account" : "I already have an account"}
          </button>
        </form>
      </main>
    );
  return (
    <main>
      <header>
        <div className="brand">
          <div className="icon">
            <Brain />
          </div>
          <div>
            <b>FocusFlow AI</b>
            <small>{user.name}'s focus dashboard</small>
          </div>
        </div>
        <button
          className="logout"
          onClick={() => {
            localStorage.clear();
            setUser(null);
          }}
        >
          <LogOut size={16} /> Log out
        </button>
      </header>
      {err && <div className="error">{err}</div>}
      <section className="hero">
        <div>
          <div className="eyebrow">TODAY</div>
          <h1>Small steps count.</h1>
          <p>Focus on what you can start, not everything you need to finish.</p>
        </div>
        <div className="heroIcon">
          <Target />
        </div>
      </section>
      <section className="grid">
        {[
          ["Tasks completed", d?.tasks.completed || 0, CheckCircle2],
          ["Focus time", `${d?.focus.minutes || 0} min`, Clock3],
          ["Interrupted", d?.focus.interrupted || 0, Target],
          ["AI used", `${d?.ai.used || 0}/${d?.ai.limit || 25}`, Sparkles],
        ].map(([a, b, I]) => (
          <div className="stat" key={a}>
            <I size={18} />
            <small>{a}</small>
            <strong>{b}</strong>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panelHead">
          <div>
            <b>Quick capture</b>
            <small>Save anything on your mind.</small>
          </div>
          <button className="primary small" onClick={add} disabled={loading}>
            Add task
          </button>
        </div>
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="e.g. Finish the first DBMS question"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
      </section>
      <section className="panel">
        <div className="panelHead">
          <div>
            <b>Tasks</b>
            <small>{d?.tasks.pending || 0} pending</small>
          </div>
        </div>
        {tasks.slice(0, 20).map((t) => (
          <div className="task" key={t._id}>
            <button
              className="check"
              onClick={() => !t.completed && complete(t._id)}
            >
              {t.completed ? "✓" : ""}
            </button>
            <div>
              <span className={t.completed ? "done" : ""}>{t.title}</span>
              <small>{t.estimatedMinutes} min</small>
            </div>
          </div>
        ))}
        {!tasks.length && (
          <p className="empty">
            No tasks yet. Add your first tiny action above.
          </p>
        )}
      </section>
      <footer>
        FocusFlow is a productivity support tool, not a medical diagnosis or
        treatment service.
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);

import { useState, useEffect, useRef } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────

type Priority = "High" | "Medium" | "Low";
type Status = "Pending" | "In Progress" | "Completed";
type Assigner = "CO" | "2IC" | "ATO" | "Other Officer";

interface TaskUpdate {
  text: string;
  date: string; // ISO string
}

interface Task {
  id: string;
  title: string;
  description: string;
  assignedBy: Assigner;
  assignerName: string;
  priority: Priority;
  status: Status;
  dateAssigned: string; // YYYY-MM-DD
  deadline: string;     // YYYY-MM-DD or ""
  updates: TaskUpdate[];
  remarks: string;
}

// ─── Config ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; label: string }> = {
  High:   { color: "#C0392B", bg: "#FDEDEC", label: "HIGH" },
  Medium: { color: "#D68910", bg: "#FEF9E7", label: "MED"  },
  Low:    { color: "#1A5276", bg: "#EAF2FF", label: "LOW"  },
};

const STATUS_CONFIG: Record<Status, { color: string; bg: string }> = {
  "Pending":     { color: "#7F8C8D", bg: "#F2F3F4" },
  "In Progress": { color: "#1A5276", bg: "#EAF2FF" },
  "Completed":   { color: "#1E8449", bg: "#EAFAF1" },
};

const ASSIGNERS: Assigner[] = ["CO", "2IC", "ATO", "Other Officer"];

const STORAGE_KEY = "tasks_v1";

// ─── localStorage shim (replaces window.storage from Claude artifact) ──────

const storage = {
  get: (key: string): string | null => {
    try { return localStorage.getItem(key); }
    catch { return null; }
  },
  set: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); }
    catch { /* quota exceeded, ignore */ }
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const emptyTask = (): Task => ({
  id: Date.now().toString(),
  title: "",
  description: "",
  assignedBy: "CO",
  assignerName: "",
  priority: "Medium",
  status: "Pending",
  dateAssigned: new Date().toISOString().slice(0, 10),
  deadline: "",
  updates: [],
  remarks: "",
});

function formatDate(d: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── Sub-components ────────────────────────────────────────────────────────

interface BadgeProps { label: string; color: string; bg: string; }

function Badge({ label, color, bg }: BadgeProps) {
  return (
    <span style={{
      background: bg, color,
      fontWeight: 700, fontSize: 10, letterSpacing: 1,
      padding: "2px 8px", borderRadius: 3,
      border: `1px solid ${color}22`, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

type View = "list" | "form" | "detail";

interface Filter {
  priority: Priority | "All";
  status: Status | "All";
  assigner: Assigner | "All";
}

export default function App() {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [view, setView]             = useState<View>("list");
  const [editTask, setEditTask]     = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [filter, setFilter]         = useState<Filter>({ priority: "All", status: "All", assigner: "All" });
  const [newUpdate, setNewUpdate]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const raw = storage.get(STORAGE_KEY);
    if (raw) {
      try { setTasks(JSON.parse(raw)); }
      catch { /* corrupted data, start fresh */ }
    }
  }, []);

  // Debounced persist
  const persistTasks = (updated: Task[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(() => {
      storage.set(STORAGE_KEY, JSON.stringify(updated));
      setSaving(false);
    }, 600);
  };

  const saveTasks = (updated: Task[]) => {
    setTasks(updated);
    persistTasks(updated);
  };

  // ── CRUD ────────────────────────────────────────────

  const openNew = () => {
    setEditTask(emptyTask());
    setView("form");
  };

  const openEdit = (task: Task) => {
    setEditTask({ ...task });
    setView("form");
  };

  const openDetail = (task: Task) => {
    setDetailTask(task);
    setNewUpdate("");
    setView("detail");
  };

  const submitForm = () => {
    if (!editTask || !editTask.title.trim()) return;
    const exists = tasks.some(t => t.id === editTask.id);
    const updated = exists
      ? tasks.map(t => t.id === editTask.id ? editTask : t)
      : [editTask, ...tasks];
    saveTasks(updated);
    setView("list");
  };

  const deleteTask = (id: string) => {
    saveTasks(tasks.filter(t => t.id !== id));
    setView("list");
  };

  const addUpdate = () => {
    if (!newUpdate.trim() || !detailTask) return;
    const update: TaskUpdate = { text: newUpdate.trim(), date: new Date().toISOString() };
    const updated = tasks.map(t =>
      t.id === detailTask.id ? { ...t, updates: [...(t.updates || []), update] } : t
    );
    const refreshed = updated.find(t => t.id === detailTask.id)!;
    setDetailTask(refreshed);
    saveTasks(updated);
    setNewUpdate("");
  };

  const updateStatus = (id: string, status: Status) => {
    const updated = tasks.map(t => t.id === id ? { ...t, status } : t);
    saveTasks(updated);
    if (detailTask?.id === id) setDetailTask(prev => prev ? { ...prev, status } : prev);
  };

  // ── Filtering ────────────────────────────────────────

  const filtered = tasks.filter(t => {
    if (filter.priority !== "All" && t.priority !== filter.priority) return false;
    if (filter.status   !== "All" && t.status   !== filter.status)   return false;
    if (filter.assigner !== "All" && t.assignedBy !== filter.assigner) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
        !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    Total:  tasks.length,
    Pending: tasks.filter(t => t.status === "Pending").length,
    High:    tasks.filter(t => t.priority === "High" && t.status !== "Completed").length,
    Done:    tasks.filter(t => t.status === "Completed").length,
  };

  // ── Styles ───────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 7,
    border: "1.5px solid #D5DCE8", fontSize: 14, background: "#F9FAFB",
    boxSizing: "border-box", marginBottom: 12, outline: "none",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle, resize: "vertical", minHeight: 68,
    fontFamily: "inherit", fontSize: 13,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    color: "#7F8C8D", display: "block", marginBottom: 4,
  };

  const modalStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "#000a",
    zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center",
  };

  const sheetStyle: React.CSSProperties = {
    background: "#fff", borderRadius: "18px 18px 0 0",
    width: "100%", maxWidth: 640, maxHeight: "92vh",
    overflowY: "auto", padding: "20px 20px 32px",
  };

  // ── Render ───────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", background: "#F0F2F5", minHeight: "100vh", color: "#1A2533" }}>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg,#0D2137 0%,#1A3A5C 100%)", color: "#fff", padding: "16px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, opacity: 0.7 }}>PAKISTAN ARMY</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Task Tracker</div>
          </div>
          <span style={{
            fontSize: 10, background: saving ? "#F39C12" : "#1E8449",
            color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: 600,
          }}>
            {saving ? "⟳ Syncing" : "✓ Synced"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, paddingBottom: 14, overflowX: "auto" }}>
          {([["Total", counts.Total], ["Pending", counts.Pending], ["High Pri", counts.High], ["Completed", counts.Done]] as [string, number][]).map(([label, num]) => (
            <div key={label} style={{ textAlign: "center", minWidth: 60 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{num}</div>
              <div style={{ fontSize: 9, opacity: 0.65, letterSpacing: 1, fontWeight: 600 }}>{label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── List View ── */}
      <div style={{ padding: "14px 16px", maxWidth: 800, margin: "0 auto" }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ fontSize: 13, padding: "6px 12px", borderRadius: 6, border: "1.5px solid #D5DCE8", background: "#fff", flex: 1, minWidth: 140, outline: "none" }}
            placeholder="Search tasks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {(["priority", "status", "assigner"] as const).map(key => (
            <select key={key}
              style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "1.5px solid #D5DCE8", background: "#fff", fontWeight: 600 }}
              value={filter[key]}
              onChange={e => setFilter({ ...filter, [key]: e.target.value as never })}
            >
              {key === "priority" && ["All", "High", "Medium", "Low"].map(v => <option key={v}>{v}</option>)}
              {key === "status"   && ["All", "Pending", "In Progress", "Completed"].map(v => <option key={v}>{v}</option>)}
              {key === "assigner" && ["All", ...ASSIGNERS].map(v => <option key={v}>{v}</option>)}
            </select>
          ))}
          <button
            style={{ background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            onClick={openNew}
          >+ New Task</button>
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#AAB" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No tasks found</div>
            <div style={{ fontSize: 13, color: "#BBB" }}>Add a new task or adjust filters</div>
          </div>
        ) : filtered.map(task => {
          const pCfg = PRIORITY_CONFIG[task.priority];
          const sCfg = STATUS_CONFIG[task.status];
          const lastUpdate = task.updates?.slice(-1)[0];
          return (
            <div key={task.id}
              style={{ background: "#fff", borderRadius: 10, padding: "13px 15px", marginBottom: 10, boxShadow: "0 1px 4px #0001", borderLeft: `4px solid ${pCfg.color}`, cursor: "pointer" }}
              onClick={() => openDetail(task)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{task.title}</div>
                <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                  <Badge label={pCfg.label} color={pCfg.color} bg={pCfg.bg} />
                  <Badge label={task.status.toUpperCase()} color={sCfg.color} bg={sCfg.bg} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#7F8C8D", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>📅 {formatDate(task.dateAssigned)}</span>
                <span>👤 {task.assignedBy === "Other Officer" ? task.assignerName || "Other" : task.assignedBy}</span>
                {task.deadline && <span>⏰ Due: {formatDate(task.deadline)}</span>}
                {task.updates?.length > 0 && <span>💬 {task.updates.length} update{task.updates.length > 1 ? "s" : ""}</span>}
              </div>
              {lastUpdate && (
                <div style={{ fontSize: 11, color: "#555", marginTop: 6, background: "#F8F9FB", borderRadius: 5, padding: "5px 8px", borderLeft: "3px solid #D5DCE8" }}>
                  <strong>Latest:</strong> {lastUpdate.text}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Form Modal ── */}
      {view === "form" && editTask && (
        <div style={modalStyle} onClick={e => { if (e.target === e.currentTarget) setView("list"); }}>
          <div style={sheetStyle}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 16 }}>
              {tasks.some(t => t.id === editTask.id) ? "Edit Task" : "New Task"}
            </div>

            <label style={labelStyle}>TASK TITLE *</label>
            <input style={inputStyle} placeholder="Brief task description"
              value={editTask.title} onChange={e => setEditTask({ ...editTask, title: e.target.value })} />

            <label style={labelStyle}>DETAILS / INSTRUCTIONS</label>
            <textarea style={textareaStyle} placeholder="Additional details…"
              value={editTask.description} onChange={e => setEditTask({ ...editTask, description: e.target.value })} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>ASSIGNED BY</label>
                <select style={{ ...inputStyle, marginBottom: 0 }}
                  value={editTask.assignedBy} onChange={e => setEditTask({ ...editTask, assignedBy: e.target.value as Assigner })}>
                  {ASSIGNERS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>OFFICER NAME</label>
                <input style={{ ...inputStyle, marginBottom: 0 }}
                  placeholder={editTask.assignedBy === "Other Officer" ? "Required" : "Optional"}
                  value={editTask.assignerName} onChange={e => setEditTask({ ...editTask, assignerName: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>PRIORITY</label>
                <select style={{ ...inputStyle, marginBottom: 0 }}
                  value={editTask.priority} onChange={e => setEditTask({ ...editTask, priority: e.target.value as Priority })}>
                  {(["High", "Medium", "Low"] as Priority[]).map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>STATUS</label>
                <select style={{ ...inputStyle, marginBottom: 0 }}
                  value={editTask.status} onChange={e => setEditTask({ ...editTask, status: e.target.value as Status })}>
                  {(Object.keys(STATUS_CONFIG) as Status[]).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>DATE ASSIGNED</label>
                <input type="date" style={{ ...inputStyle, marginBottom: 0 }}
                  value={editTask.dateAssigned} onChange={e => setEditTask({ ...editTask, dateAssigned: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>DEADLINE (OPT)</label>
                <input type="date" style={{ ...inputStyle, marginBottom: 0 }}
                  value={editTask.deadline} onChange={e => setEditTask({ ...editTask, deadline: e.target.value })} />
              </div>
            </div>

            <label style={labelStyle}>REMARKS</label>
            <textarea style={{ ...textareaStyle, minHeight: 50 }} placeholder="Any remarks or notes…"
              value={editTask.remarks} onChange={e => setEditTask({ ...editTask, remarks: e.target.value })} />

            <button style={{ background: "#0D2137", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%", marginTop: 4 }}
              onClick={submitForm}>Save Task</button>
            <button style={{ background: "#F2F3F4", color: "#555", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%", marginTop: 8 }}
              onClick={() => setView("list")}>Cancel</button>
            {tasks.some(t => t.id === editTask.id) && (
              <button style={{ background: "#FDEDEC", color: "#C0392B", border: "1px solid #C0392B44", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", marginTop: 8 }}
                onClick={() => deleteTask(editTask.id)}>🗑 Delete Task</button>
            )}
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {view === "detail" && detailTask && (() => {
        const task = tasks.find(t => t.id === detailTask.id) || detailTask;
        const pCfg = PRIORITY_CONFIG[task.priority];
        return (
          <div style={modalStyle} onClick={e => { if (e.target === e.currentTarget) setView("list"); }}>
            <div style={sheetStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ fontSize: 17, fontWeight: 800, flex: 1, paddingRight: 8 }}>{task.title}</div>
                <Badge label={pCfg.label} color={pCfg.color} bg={pCfg.bg} />
              </div>
              <div style={{ fontSize: 11, color: "#999", marginBottom: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>📅 {formatDate(task.dateAssigned)}</span>
                <span>👤 {task.assignedBy === "Other Officer" ? task.assignerName || "Other" : task.assignedBy}
                  {task.assignerName && task.assignedBy !== "Other Officer" ? ` (${task.assignerName})` : ""}
                </span>
                {task.deadline && <span>⏰ Due {formatDate(task.deadline)}</span>}
              </div>

              {task.description && (
                <div style={{ background: "#F8F9FB", borderRadius: 7, padding: "10px 12px", marginBottom: 14, fontSize: 13 }}>
                  {task.description}
                </div>
              )}
              {task.remarks && (
                <div style={{ background: "#FFFBEA", borderRadius: 7, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "#8B6914" }}>
                  <strong>Remarks:</strong> {task.remarks}
                </div>
              )}

              <label style={labelStyle}>UPDATE STATUS</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {(Object.entries(STATUS_CONFIG) as [Status, { color: string; bg: string }][]).map(([st, cfg]) => (
                  <button key={st} onClick={() => updateStatus(task.id, st)} style={{
                    fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 20, cursor: "pointer",
                    border: `2px solid ${task.status === st ? cfg.color : "#D5DCE8"}`,
                    background: task.status === st ? cfg.bg : "#fff",
                    color: cfg.color,
                  }}>{st}</button>
                ))}
              </div>

              <label style={labelStyle}>PROGRESS LOG ({task.updates?.length || 0})</label>
              {(task.updates || []).length === 0 && (
                <div style={{ fontSize: 12, color: "#BBB", marginBottom: 10 }}>No updates yet.</div>
              )}
              {(task.updates || []).map((u, i) => (
                <div key={i} style={{ background: "#F8F9FB", borderRadius: 7, padding: "8px 10px", marginBottom: 7, borderLeft: "3px solid #1A3A5C" }}>
                  <div style={{ fontSize: 13 }}>{u.text}</div>
                  <div style={{ fontSize: 10, color: "#999", marginTop: 3 }}>
                    {new Date(u.date).toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <textarea
                  style={{ ...textareaStyle, flex: 1, marginBottom: 0, minHeight: 44 }}
                  placeholder="Add progress update…"
                  value={newUpdate}
                  onChange={e => setNewUpdate(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addUpdate(); } }}
                />
                <button onClick={addUpdate} style={{ background: "#0D2137", color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Add
                </button>
              </div>

              <button style={{ background: "#0D2137", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%", marginTop: 16 }}
                onClick={() => openEdit(task)}>✏️ Edit Task</button>
              <button style={{ background: "#F2F3F4", color: "#555", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%", marginTop: 8 }}
                onClick={() => setView("list")}>← Back to List</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

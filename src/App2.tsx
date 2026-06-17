import { useState, useEffect, useRef, type CSSProperties } from "react";

// ─── Persistent storage shape (provided by the host environment) ───
declare global {
  interface Window {
    storage: {
      get: (
        key: string,
        shared?: boolean
      ) => Promise<{ key: string; value: string; shared: boolean } | null>;
      set: (
        key: string,
        value: string,
        shared?: boolean
      ) => Promise<{ key: string; value: string; shared: boolean } | null>;
      delete: (
        key: string,
        shared?: boolean
      ) => Promise<{ key: string; deleted: boolean; shared: boolean } | null>;
      list: (
        prefix?: string,
        shared?: boolean
      ) => Promise<{ keys: string[]; prefix?: string; shared: boolean } | null>;
    };
  }
}

// ─── Types ───────────────────────────────────────────
interface TaskUpdate {
  text: string;
  date: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  assignedBy: string;
  assignerName: string;
  priority: string;
  status: string;
  dateAssigned: string;
  deadline: string;
  updates: TaskUpdate[];
  remarks: string;
}

interface BadgeConfig {
  color: string;
  bg: string;
  label: string;
}

interface StatusConfig {
  color: string;
  bg: string;
}

interface SectionMeta {
  color: string;
  label: string;
}

type View = "list" | "form" | "detail";

interface Filter {
  priority: string;
  status: string;
  assigner: string;
}

const PRIORITY_CONFIG: Record<string, BadgeConfig> = {
  High: { color: "#C0392B", bg: "#FDEDEC", label: "HIGH" },
  Medium: { color: "#D68910", bg: "#FEF9E7", label: "MED" },
  Low: { color: "#1A5276", bg: "#EAF2FF", label: "LOW" },
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  Pending: { color: "#7F8C8D", bg: "#F2F3F4" },
  "In Progress": { color: "#1A5276", bg: "#EAF2FF" },
  Completed: { color: "#1E8449", bg: "#EAFAF1" },
};

const ASSIGNERS: string[] = ["CO", "2IC", "ATO", "Other Officer"];

const emptyTask: Task = {
  id: "",
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
};

function formatDate(d: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <span
      style={{
        background: bg,
        color,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: 1,
        padding: "2px 8px",
        borderRadius: 3,
        border: `1px solid ${color}22`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

const SECTION_META: Record<string, SectionMeta> = {
  Pending: { color: "#7F8C8D", label: "Pending" },
  "In Progress": { color: "#1A5276", label: "In Progress" },
  Completed: { color: "#1E8449", label: "Completed" },
};

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<View>("list"); // list | form | detail
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<Filter>({
    priority: "All",
    status: "All",
    assigner: "All",
  });
  const [newUpdate, setNewUpdate] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from storage
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("tasks_v1", false);
        if (result?.value) setTasks(JSON.parse(result.value));
      } catch {}
      setLoading(false);
    })();
  }, []);

  // Save to storage with debounce
  const persistTasks = (updated: Task[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set("tasks_v1", JSON.stringify(updated), false);
      } catch {}
      setSaving(false);
    }, 600);
  };

  const saveTasks = (updated: Task[]) => {
    setTasks(updated);
    persistTasks(updated);
  };

  const openNew = () => {
    setEditTask({ ...emptyTask, id: Date.now().toString() });
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
    if (!editTask) return;
    const current = editTask;
    if (!current.title.trim()) return;
    const exists = tasks.find((t) => t.id === current.id);
    const updated = exists
      ? tasks.map((t) => (t.id === current.id ? current : t))
      : [current, ...tasks];
    saveTasks(updated);
    setView("list");
  };

  const deleteTask = (id: string) => {
    saveTasks(tasks.filter((t) => t.id !== id));
    setView("list");
  };

  const addUpdate = () => {
    if (!newUpdate.trim() || !detailTask) return;
    const dt = detailTask;
    const update: TaskUpdate = {
      text: newUpdate.trim(),
      date: new Date().toISOString(),
    };
    const updated = tasks.map((t) =>
      t.id === dt.id ? { ...t, updates: [...(t.updates || []), update] } : t
    );
    const refreshed = updated.find((t) => t.id === dt.id);
    if (refreshed) setDetailTask(refreshed);
    saveTasks(updated);
    setNewUpdate("");
  };

  const updateStatus = (id: string, status: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, status } : t));
    saveTasks(updated);
    if (detailTask?.id === id) setDetailTask({ ...detailTask, status });
  };

  const filtered = tasks.filter((t) => {
    if (filter.priority !== "All" && t.priority !== filter.priority) return false;
    if (filter.status !== "All" && t.status !== filter.status) return false;
    if (filter.assigner !== "All" && t.assignedBy !== filter.assigner) return false;
    if (
      search &&
      !t.title.toLowerCase().includes(search.toLowerCase()) &&
      !t.description?.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const counts = {
    High: tasks.filter((t) => t.priority === "High" && t.status !== "Completed")
      .length,
    Pending: tasks.filter((t) => t.status === "Pending").length,
    Total: tasks.length,
    Done: tasks.filter((t) => t.status === "Completed").length,
  };

  // ─── Styles ───────────────────────────────────────────
  const s: Record<string, CSSProperties> = {
    root: {
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      background: "#F0F2F5",
      minHeight: "100vh",
      color: "#1A2533",
    },
    header: {
      background: "linear-gradient(135deg, #0D2137 0%, #1A3A5C 100%)",
      color: "#fff",
      padding: "16px 20px 0",
    },
    headerTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    logo: { fontSize: 13, fontWeight: 700, letterSpacing: 2, opacity: 0.7 },
    title: { fontSize: 20, fontWeight: 800, letterSpacing: 0.5 },
    syncBadge: {
      fontSize: 10,
      background: saving ? "#F39C12" : "#1E8449",
      color: "#fff",
      padding: "2px 8px",
      borderRadius: 10,
      fontWeight: 600,
    },
    statsRow: {
      display: "flex",
      gap: 12,
      paddingBottom: 14,
      overflowX: "auto",
    },
    stat: {
      textAlign: "center",
      minWidth: 60,
    },
    statNum: { fontSize: 22, fontWeight: 800 },
    statLabel: { fontSize: 9, opacity: 0.65, letterSpacing: 1, fontWeight: 600 },
    content: { padding: "14px 16px", maxWidth: 800, margin: "0 auto" },
    filterRow: {
      display: "flex",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap",
      alignItems: "center",
    },
    select: {
      fontSize: 12,
      padding: "5px 10px",
      borderRadius: 6,
      border: "1.5px solid #D5DCE8",
      background: "#fff",
      color: "#1A2533",
      fontWeight: 600,
    },
    searchInput: {
      fontSize: 13,
      padding: "6px 12px",
      borderRadius: 6,
      border: "1.5px solid #D5DCE8",
      background: "#fff",
      flex: 1,
      minWidth: 140,
      outline: "none",
    },
    addBtn: {
      background: "#C0392B",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "8px 18px",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    card: {
      background: "#fff",
      borderRadius: 10,
      padding: "13px 15px",
      marginBottom: 10,
      boxShadow: "0 1px 4px #0001",
      borderLeft: "4px solid",
      cursor: "pointer",
      transition: "box-shadow 0.15s",
    },
    cardTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 8,
    },
    cardTitle: { fontWeight: 700, fontSize: 14, flex: 1 },
    cardMeta: {
      fontSize: 11,
      color: "#7F8C8D",
      marginTop: 4,
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    },
    cardUpdate: {
      fontSize: 11,
      color: "#555",
      marginTop: 6,
      background: "#F8F9FB",
      borderRadius: 5,
      padding: "5px 8px",
      borderLeft: "3px solid #D5DCE8",
    },
    modal: {
      position: "fixed",
      inset: 0,
      background: "#000a",
      zIndex: 100,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
    },
    sheet: {
      background: "#fff",
      borderRadius: "18px 18px 0 0",
      width: "100%",
      maxWidth: 640,
      maxHeight: "92vh",
      overflowY: "auto",
      padding: "20px 20px 32px",
    },
    sheetTitle: { fontSize: 17, fontWeight: 800, marginBottom: 16 },
    label: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.5,
      color: "#7F8C8D",
      display: "block",
      marginBottom: 4,
    },
    input: {
      width: "100%",
      padding: "8px 10px",
      borderRadius: 7,
      border: "1.5px solid #D5DCE8",
      fontSize: 14,
      background: "#F9FAFB",
      boxSizing: "border-box",
      marginBottom: 12,
      outline: "none",
    },
    textarea: {
      width: "100%",
      padding: "8px 10px",
      borderRadius: 7,
      border: "1.5px solid #D5DCE8",
      fontSize: 13,
      background: "#F9FAFB",
      boxSizing: "border-box",
      marginBottom: 12,
      resize: "vertical",
      minHeight: 68,
      outline: "none",
      fontFamily: "inherit",
    },
    row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    saveBtn: {
      background: "#0D2137",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "10px 0",
      fontWeight: 700,
      fontSize: 14,
      cursor: "pointer",
      width: "100%",
      marginTop: 4,
    },
    cancelBtn: {
      background: "#F2F3F4",
      color: "#555",
      border: "none",
      borderRadius: 8,
      padding: "10px 0",
      fontWeight: 700,
      fontSize: 14,
      cursor: "pointer",
      width: "100%",
      marginTop: 8,
    },
    delBtn: {
      background: "#FDEDEC",
      color: "#C0392B",
      border: "1px solid #C0392B44",
      borderRadius: 8,
      padding: "8px 0",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
      width: "100%",
      marginTop: 8,
    },
    updateEntry: {
      background: "#F8F9FB",
      borderRadius: 7,
      padding: "8px 10px",
      marginBottom: 7,
      borderLeft: "3px solid #1A3A5C",
    },
    updateText: { fontSize: 13 },
    updateDate: { fontSize: 10, color: "#999", marginTop: 3 },
    statusBtns: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 },
    statusBtn: {
      fontSize: 12,
      fontWeight: 700,
      padding: "5px 14px",
      borderRadius: 20,
      cursor: "pointer",
      border: "2px solid",
    },
    empty: { textAlign: "center", padding: "48px 0", color: "#AAB" },
    sectionHeader: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      margin: "18px 0 10px",
    },
    sectionDot: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      flexShrink: 0,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 800,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    sectionCount: {
      fontSize: 11,
      fontWeight: 700,
      color: "#9AA5B1",
      background: "#E8EBEF",
      borderRadius: 10,
      padding: "1px 8px",
    },
    sectionLine: {
      flex: 1,
      height: 1,
      background: "#E0E4EA",
    },
    completedCard: {
      opacity: 0.8,
    },
    checkCircle: {
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: "#1E8449",
      color: "#fff",
      fontSize: 11,
      fontWeight: 900,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
  };

  // ─── Render ───────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          ...s.root,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ color: "#1A3A5C", fontWeight: 700, fontSize: 15 }}>
          Loading tasks…
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <div>
            <div style={s.logo}>PAKISTAN ARMY</div>
            <div style={s.title}>Task Tracker</div>
          </div>
          <span style={s.syncBadge}>{saving ? "⟳ Syncing" : "✓ Synced"}</span>
        </div>
        <div style={s.statsRow}>
          {[
            { num: counts.Total, label: "TOTAL" },
            { num: counts.Pending, label: "PENDING" },
            { num: counts.High, label: "HIGH PRI" },
            { num: counts.Done, label: "COMPLETED" },
          ].map((s2) => (
            <div key={s2.label} style={s.stat}>
              <div style={s.statNum}>{s2.num}</div>
              <div style={s.statLabel}>{s2.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {/* Filters */}
        <div style={s.filterRow}>
          <input
            style={s.searchInput}
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            style={s.select}
            value={filter.priority}
            onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
          >
            {["All", "High", "Medium", "Low"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            style={s.select}
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            {["All", "Pending", "In Progress", "Completed"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            style={s.select}
            value={filter.assigner}
            onChange={(e) => setFilter({ ...filter, assigner: e.target.value })}
          >
            {["All", ...ASSIGNERS].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button style={s.addBtn} onClick={openNew}>
            + New Task
          </button>
        </div>

        {/* Task List — grouped by status */}
        {filtered.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No tasks found</div>
            <div style={{ fontSize: 13, color: "#BBB" }}>
              Add a new task or adjust filters
            </div>
          </div>
        ) : (
          ["Pending", "In Progress", "Completed"].map((statusGroup) => {
            const group = filtered
              .filter((t) => t.status === statusGroup)
              .sort(
                (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
              );
            if (group.length === 0) return null;
            const meta = SECTION_META[statusGroup];
            return (
              <div key={statusGroup}>
                <div style={s.sectionHeader}>
                  <span style={{ ...s.sectionDot, background: meta.color }} />
                  <span style={{ ...s.sectionTitle, color: meta.color }}>
                    {meta.label}
                  </span>
                  <span style={s.sectionCount}>{group.length}</span>
                  <span style={s.sectionLine} />
                </div>
                {group.map((task) => {
                  const pCfg = PRIORITY_CONFIG[task.priority];
                  const sCfg = STATUS_CONFIG[task.status];
                  const lastUpdate = task.updates?.slice(-1)[0];
                  const isCompleted = task.status === "Completed";
                  return (
                    <div
                      key={task.id}
                      style={{
                        ...s.card,
                        ...(isCompleted ? s.completedCard : {}),
                        borderLeftColor: pCfg.color,
                      }}
                      onClick={() => openDetail(task)}
                    >
                      <div style={s.cardTop}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            flex: 1,
                          }}
                        >
                          {isCompleted && <span style={s.checkCircle}>✓</span>}
                          <div
                            style={{
                              ...s.cardTitle,
                              textDecoration: isCompleted ? "line-through" : "none",
                              color: isCompleted ? "#7F8C8D" : "#1A2533",
                            }}
                          >
                            {task.title}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                          <Badge label={pCfg.label} color={pCfg.color} bg={pCfg.bg} />
                          {!isCompleted && (
                            <Badge
                              label={task.status.toUpperCase()}
                              color={sCfg.color}
                              bg={sCfg.bg}
                            />
                          )}
                        </div>
                      </div>
                      <div style={s.cardMeta}>
                        <span>📅 {formatDate(task.dateAssigned)}</span>
                        <span>
                          👤{" "}
                          {task.assignedBy === "Other Officer"
                            ? task.assignerName || "Other"
                            : task.assignedBy}
                        </span>
                        {task.deadline && (
                          <span>⏰ Due: {formatDate(task.deadline)}</span>
                        )}
                        {task.updates?.length > 0 && (
                          <span>
                            💬 {task.updates.length} update
                            {task.updates.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {lastUpdate && (
                        <div style={s.cardUpdate}>
                          <strong>Latest:</strong> {lastUpdate.text}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* ─── Form Modal ─── */}
      {view === "form" && editTask && (
        <div
          style={s.modal}
          onClick={(e) => {
            if (e.target === e.currentTarget) setView("list");
          }}
        >
          <div style={s.sheet}>
            <div style={s.sheetTitle}>
              {tasks.find((t) => t.id === editTask.id) ? "Edit Task" : "New Task"}
            </div>

            <label style={s.label}>TASK TITLE *</label>
            <input
              style={s.input}
              placeholder="Brief task description"
              value={editTask.title}
              onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
            />

            <label style={s.label}>DETAILS / INSTRUCTIONS</label>
            <textarea
              style={s.textarea}
              placeholder="Additional details…"
              value={editTask.description}
              onChange={(e) =>
                setEditTask({ ...editTask, description: e.target.value })
              }
            />

            <div style={s.row2}>
              <div>
                <label style={s.label}>ASSIGNED BY</label>
                <select
                  style={{ ...s.input, marginBottom: 0 }}
                  value={editTask.assignedBy}
                  onChange={(e) =>
                    setEditTask({ ...editTask, assignedBy: e.target.value })
                  }
                >
                  {ASSIGNERS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={s.label}>OFFICER NAME</label>
                <input
                  style={{ ...s.input, marginBottom: 0 }}
                  placeholder={
                    editTask.assignedBy === "Other Officer"
                      ? "Required"
                      : "Optional"
                  }
                  value={editTask.assignerName}
                  onChange={(e) =>
                    setEditTask({ ...editTask, assignerName: e.target.value })
                  }
                />
              </div>
            </div>
            <div style={{ marginBottom: 12 }} />

            <div style={s.row2}>
              <div>
                <label style={s.label}>PRIORITY</label>
                <select
                  style={{ ...s.input, marginBottom: 0 }}
                  value={editTask.priority}
                  onChange={(e) =>
                    setEditTask({ ...editTask, priority: e.target.value })
                  }
                >
                  {["High", "Medium", "Low"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={s.label}>STATUS</label>
                <select
                  style={{ ...s.input, marginBottom: 0 }}
                  value={editTask.status}
                  onChange={(e) =>
                    setEditTask({ ...editTask, status: e.target.value })
                  }
                >
                  {Object.keys(STATUS_CONFIG).map((s2) => (
                    <option key={s2}>{s2}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }} />

            <div style={s.row2}>
              <div>
                <label style={s.label}>DATE ASSIGNED</label>
                <input
                  type="date"
                  style={{ ...s.input, marginBottom: 0 }}
                  value={editTask.dateAssigned}
                  onChange={(e) =>
                    setEditTask({ ...editTask, dateAssigned: e.target.value })
                  }
                />
              </div>
              <div>
                <label style={s.label}>DEADLINE (OPT)</label>
                <input
                  type="date"
                  style={{ ...s.input, marginBottom: 0 }}
                  value={editTask.deadline}
                  onChange={(e) =>
                    setEditTask({ ...editTask, deadline: e.target.value })
                  }
                />
              </div>
            </div>
            <div style={{ marginBottom: 12 }} />

            <label style={s.label}>REMARKS</label>
            <textarea
              style={{ ...s.textarea, minHeight: 50 }}
              placeholder="Any remarks or notes…"
              value={editTask.remarks}
              onChange={(e) =>
                setEditTask({ ...editTask, remarks: e.target.value })
              }
            />

            <button style={s.saveBtn} onClick={submitForm}>
              Save Task
            </button>
            <button style={s.cancelBtn} onClick={() => setView("list")}>
              Cancel
            </button>
            {tasks.find((t) => t.id === editTask.id) && (
              <button style={s.delBtn} onClick={() => deleteTask(editTask.id)}>
                🗑 Delete Task
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Detail Modal ─── */}
      {view === "detail" &&
        detailTask &&
        (() => {
          const task = tasks.find((t) => t.id === detailTask.id) || detailTask;
          const pCfg = PRIORITY_CONFIG[task.priority];
          return (
            <div
              style={s.modal}
              onClick={(e) => {
                if (e.target === e.currentTarget) setView("list");
              }}
            >
              <div style={s.sheet}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      flex: 1,
                      paddingRight: 8,
                    }}
                  >
                    {task.title}
                  </div>
                  <Badge label={pCfg.label} color={pCfg.color} bg={pCfg.bg} />
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#999",
                    marginBottom: 14,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span>📅 {formatDate(task.dateAssigned)}</span>
                  <span>
                    👤{" "}
                    {task.assignedBy === "Other Officer"
                      ? task.assignerName || "Other"
                      : task.assignedBy}
                    {task.assignerName && task.assignedBy !== "Other Officer"
                      ? ` (${task.assignerName})`
                      : ""}
                  </span>
                  {task.deadline && <span>⏰ Due {formatDate(task.deadline)}</span>}
                </div>

                {task.description && (
                  <div
                    style={{
                      background: "#F8F9FB",
                      borderRadius: 7,
                      padding: "10px 12px",
                      marginBottom: 14,
                      fontSize: 13,
                    }}
                  >
                    {task.description}
                  </div>
                )}
                {task.remarks && (
                  <div
                    style={{
                      background: "#FFFBEA",
                      borderRadius: 7,
                      padding: "8px 12px",
                      marginBottom: 14,
                      fontSize: 12,
                      color: "#8B6914",
                    }}
                  >
                    <strong>Remarks:</strong> {task.remarks}
                  </div>
                )}

                {/* Status */}
                <label style={s.label}>UPDATE STATUS</label>
                <div style={s.statusBtns}>
                  {Object.entries(STATUS_CONFIG).map(([st, cfg]) => (
                    <button
                      key={st}
                      style={{
                        ...s.statusBtn,
                        background: task.status === st ? cfg.bg : "#fff",
                        color: cfg.color,
                        borderColor: task.status === st ? cfg.color : "#D5DCE8",
                      }}
                      onClick={() => updateStatus(task.id, st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Updates log */}
                <label style={s.label}>
                  PROGRESS LOG ({task.updates?.length || 0})
                </label>
                {(task.updates || []).length === 0 && (
                  <div style={{ fontSize: 12, color: "#BBB", marginBottom: 10 }}>
                    No updates yet.
                  </div>
                )}
                {(task.updates || []).map((u, i) => (
                  <div key={i} style={s.updateEntry}>
                    <div style={s.updateText}>{u.text}</div>
                    <div style={s.updateDate}>
                      {new Date(u.date).toLocaleString("en-PK", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <textarea
                    style={{ ...s.textarea, flex: 1, marginBottom: 0, minHeight: 44 }}
                    placeholder="Add progress update…"
                    value={newUpdate}
                    onChange={(e) => setNewUpdate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        addUpdate();
                      }
                    }}
                  />
                  <button
                    onClick={addUpdate}
                    style={{
                      background: "#0D2137",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "0 16px",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Add
                  </button>
                </div>

                <button
                  style={{ ...s.saveBtn, marginTop: 16 }}
                  onClick={() => openEdit(task)}
                >
                  ✏️ Edit Task
                </button>
                <button style={s.cancelBtn} onClick={() => setView("list")}>
                  ← Back to List
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
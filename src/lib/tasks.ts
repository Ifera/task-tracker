import { supabase } from "./supabase";

export interface TaskUpdate {
  text: string;
  date: string;
}

export interface Task {
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

interface DbRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  assigned_by: string;
  assigner_name: string;
  priority: string;
  status: string;
  date_assigned: string;
  deadline: string;
  updates: TaskUpdate[];
  remarks: string;
}

function fromDb(row: DbRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    assignedBy: row.assigned_by ?? "CO",
    assignerName: row.assigner_name ?? "",
    priority: row.priority ?? "Medium",
    status: row.status ?? "Pending",
    dateAssigned: row.date_assigned ?? "",
    deadline: row.deadline ?? "",
    updates: row.updates ?? [],
    remarks: row.remarks ?? "",
  };
}

function toDb(task: Task, userId: string): DbRow {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    description: task.description,
    assigned_by: task.assignedBy,
    assigner_name: task.assignerName,
    priority: task.priority,
    status: task.status,
    date_assigned: task.dateAssigned,
    deadline: task.deadline,
    updates: task.updates,
    remarks: task.remarks,
  };
}

export async function fetchTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as DbRow[]).map(fromDb);
}

export async function upsertTask(task: Task, userId: string): Promise<void> {
  const { error } = await supabase.from("tasks").upsert(toDb(task, userId));
  if (error) throw error;
}

export async function removeTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

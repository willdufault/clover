import { PRIORITIES } from "../constants/priorities"
export type TaskPriority = typeof PRIORITIES[keyof typeof PRIORITIES]

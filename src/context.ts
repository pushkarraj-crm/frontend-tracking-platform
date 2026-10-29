import { createContext, useContext } from "react";
import type { Session } from "./api";
export const SessionContext = createContext<Session | null>(null);
export function useSession() {
  return useContext(SessionContext)!;
}
export const ToastContext = createContext<(message: string) => void>(() => {});
export function useToast() {
  return useContext(ToastContext);
}
export const staff = (role: string) => ["admin", "staff"].includes(role);
// brand | network | influencer, from /workspace; defaults to network while loading.
export const AccountTypeContext = createContext("network");
export function useAccountType() {
  return useContext(AccountTypeContext);
}

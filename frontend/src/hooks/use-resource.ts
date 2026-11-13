"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Row = Record<string, any>;

/** All rows of an API resource, e.g. useList("customers") -> GET /customers. */
export function useList<T = Row>(resource: string, enabled = true) {
  return useQuery({
    queryKey: [resource],
    queryFn: async () => (await api.get<T[]>(`/${resource}`)).data,
    enabled,
    retry: false,
  });
}

/** Create (no id) or update (with id). Accepts JSON or FormData (file uploads). */
export function useSave(resource: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: number; payload: Row | FormData }) =>
      (id ? await api.put(`/${resource}/${id}`, payload) : await api.post(`/${resource}`, payload)).data,
    // Records feed each other (a transaction moves ledger balances, customer dues and the dashboard),
    // so every cached list is refreshed after a change.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useRemove(resource: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/${resource}/${id}`),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

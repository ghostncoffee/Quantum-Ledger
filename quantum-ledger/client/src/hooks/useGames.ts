import { useQuery } from '@tanstack/react-query';
import { gamesApi, crewApi } from '@/lib/api';

export function useGames() {
  return useQuery({ queryKey: ['games'], queryFn: gamesApi.list, staleTime: 60_000 });
}

export function useCrewList(gameId?: number) {
  return useQuery({
    queryKey: ['crew', gameId],
    queryFn: () => crewApi.list(gameId),
    staleTime: 30_000,
  });
}

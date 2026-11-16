import { useQuery } from '@tanstack/react-query';
import { actionPermissionsApi, type ActionCode, type ActionPermission } from '../services/actionPermissionsApi';
import { usePermissionsIdentity } from './usePermissionsIdentity';

export function useActionPermissions() {
  const { user, scope } = usePermissionsIdentity();
  const query = useQuery({ queryKey: ['action-permissions-me', ...scope], queryFn: actionPermissionsApi.mine, enabled: Boolean(user), retry: false, staleTime: 30_000 });
  const valid = Array.isArray(query.data);
  const actions: ActionPermission[] = user && valid ? query.data! : [];
  const ready = Boolean(user) && query.isSuccess && valid;
  return {
    actions,
    can: (actionCode: ActionCode) => ready && actions.some(action => action.actionCode === actionCode && action.allowed === true),
    isLoading: Boolean(user) && query.isPending,
    isError: query.isError || (query.isSuccess && !valid),
    ready,
  };
}

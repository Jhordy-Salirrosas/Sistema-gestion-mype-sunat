import { useServerPermissions } from './useServerPermissions';
export function useActionPermissions(){
 const permissions=useServerPermissions();
 return {actions:permissions.actions,can:permissions.canAction,canShow:(code:string)=>permissions.actions.some(a=>a.actionCode===code&&(a.available??a.allowed)),ready:permissions.ready,isLoading:permissions.isLoading,isError:permissions.isError};
}

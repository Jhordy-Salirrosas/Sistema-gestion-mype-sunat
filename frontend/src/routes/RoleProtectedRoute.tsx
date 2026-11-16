import type { ReactNode } from 'react';
import { Link,Outlet,useLocation } from 'react-router-dom';
import { useServerPermissions } from '@/modules/auth/hooks/useServerPermissions';
import { getPermissionHome } from './roleNavigation';
export const RoleProtectedRoute=({children}:{children?:ReactNode})=>{
 const p=useServerPermissions();const {pathname}=useLocation();
 if(p.isLoading)return <p role="status">Consultando accesos…</p>;
 if(p.isError)return <div role="alert">No se pudieron consultar los permisos. <button type="button" onClick={()=>void p.refetch()}>Reintentar</button></div>;
 if(!p.canNavigate(pathname))return <div id="forbidden-403-container" role="alert"><span>Código 403</span><h1>Módulo Restringido</h1><p>Rol: {p.snapshot?.role.code}</p><p>No tiene permiso para consultar esta sección.</p><Link to={getPermissionHome(p.homePath)}>Volver a una sección permitida</Link></div>;
 return children?<>{children}</>:<Outlet/>;
};

/** El inicio lo determina el servidor entre los menús efectivamente visibles. */
export const getPermissionHome=(homePath:string|null|undefined)=>homePath??'/sin-accesos';

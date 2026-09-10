export type AuthUser={id:string;username:string;displayName:string;role:'admin'|'member'};
export type InviteSummary={id:string;label:string;prefix:string;maxUses:number;used:number;expiresAt:number;revoked:number;createdAt:number};
export type MemberSummary={id:string;username:string;displayName:string;role:string;createdAt:number};


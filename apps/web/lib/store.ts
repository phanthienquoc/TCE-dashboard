'use client';
import { create } from 'zustand';
import { authApi, setAccessToken } from './api';

type User={id:string;email:string;role:string;mfaEnabled:boolean};
type AuthStatus='loading'|'authenticated'|'anonymous';
type AuthState={user:User|null;status:AuthStatus;loading:boolean;initialized:boolean;error:string|null;init:()=>Promise<void>;login:(e:string,p:string)=>Promise<{mfaRequired?:boolean;userId?:string}>;mfa:(id:string,c:string)=>Promise<void>;logout:()=>Promise<void>};

export const useAuthStore=create<AuthState>((set,get)=>({
  user:null,status:'loading',loading:true,initialized:false,error:null,
  init:async()=>{if(get().initialized)return;set({status:'loading',loading:true,error:null});try{const r=await authApi.me();set({user:r.data.user,status:'authenticated',initialized:true});}catch{try{const r=await authApi.refresh();setAccessToken(r.data.accessToken);const me=await authApi.me();set({user:me.data.user,status:'authenticated',initialized:true});}catch{setAccessToken(null);set({user:null,status:'anonymous',initialized:true});}}finally{set({loading:false});}},
  login:async(e,p)=>{set({status:'loading',loading:true,error:null});try{const r=await authApi.login(e,p);if(r.data.mfaRequired){set({status:'anonymous'});return r.data;}setAccessToken(r.data.accessToken);const me=await authApi.me();set({user:me.data.user,status:'authenticated',initialized:true});return r.data;}catch(err:any){set({status:'anonymous',error:err?.response?.data?.message??'Login failed'});throw err;}finally{set({loading:false});}},
  mfa:async(id,c)=>{set({status:'loading',loading:true,error:null});try{const r=await authApi.mfaLogin(id,c);setAccessToken(r.data.accessToken);const me=await authApi.me();set({user:me.data.user,status:'authenticated',initialized:true});}catch(err){set({status:'anonymous'});throw err;}finally{set({loading:false});}},
  logout:async()=>{try{await authApi.logout();}finally{setAccessToken(null);set({user:null,status:'anonymous',initialized:true});}}
}));

type DashboardState={data:any;loading:boolean;error:string|null;load:()=>Promise<void>};
export const useDashboardStore=create<DashboardState>((set)=>({data:null,loading:false,error:null,load:async()=>{set({loading:true,error:null});try{const r=await import('./api').then(x=>x.dashboardApi.all());set({data:r.data});}catch(e:any){set({error:e?.response?.data?.message??'Unable to load dashboard'});}finally{set({loading:false});}}}));

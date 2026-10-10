"use client";
import {useEffect,useState} from "react";
export default function Preferences(){
 const [theme,setTheme]=useState("system"),[size,setSize]=useState("normal");
 useEffect(()=>{const t=localStorage.getItem("tf-theme")||"system",s=localStorage.getItem("tf-size")||"normal";setTheme(t);setSize(s);document.documentElement.dataset.theme=t;document.documentElement.dataset.size=s},[]);
 function changeTheme(v:string){setTheme(v);localStorage.setItem("tf-theme",v);document.documentElement.dataset.theme=v}
 function changeSize(v:string){setSize(v);localStorage.setItem("tf-size",v);document.documentElement.dataset.size=v}
 return <section className="panel"><h2>Darstellung</h2><div className="settings-grid"><label>Design<select value={theme} onChange={e=>changeTheme(e.target.value)}><option value="system">System</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label><label>Schriftgröße<select value={size} onChange={e=>changeSize(e.target.value)}><option value="small">Klein</option><option value="normal">Normal</option><option value="large">Groß</option></select></label></div><p className="muted">Die Einstellungen werden auf diesem Gerät gespeichert.</p></section>
}
"use client";

import AppNav from "../components/AppNav";
import Desk from "./Desk";

export default function Search() {
  return (
    <div style={{ minHeight: "100dvh" }}>
      <AppNav />
      <Desk locked="firm" />
    </div>
  );
}

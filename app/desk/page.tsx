import AppNav from "../../web/src/components/AppNav";
import Desk from "../../web/src/pages/Desk";
import { EngineMark } from "../EngineMark";

export const dynamic = "force-dynamic";

export default function DeskPage() {
  return (
    <>
      <EngineMark />
      <div style={{ minHeight: "100dvh" }}>
        <AppNav />
        <Desk />
      </div>
    </>
  );
}

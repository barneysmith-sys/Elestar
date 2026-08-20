import Intros from "../../web/src/pages/Intros";
import { EngineMark } from "../EngineMark";

export const dynamic = "force-dynamic";

export default function BriefPage() {
  return (
    <>
      <EngineMark />
      <Intros />
    </>
  );
}

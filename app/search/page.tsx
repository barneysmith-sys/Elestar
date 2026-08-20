import Search from "../../web/src/pages/Search";
import { EngineMark } from "../EngineMark";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  return (
    <>
      <EngineMark />
      <Search />
    </>
  );
}

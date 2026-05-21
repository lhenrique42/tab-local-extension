import { useTheme } from "../../composables/useTheme";
import { useStorage } from "../../lib/hooks/useStorage";
import { Workspace } from "../../components/workspace";

export default function App() {
    useTheme();
    const [root, loading, quotaWarning] = useStorage();
    return (
        <Workspace root={root} loading={loading} quotaWarning={quotaWarning} />
    );
}

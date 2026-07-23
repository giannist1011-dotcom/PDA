import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Truck, LogOut, Users, LayoutGrid } from "lucide-react";
import { useFleet } from "@/context/FleetAuthContext";

// Κοινό κέλυφος των Fleet σελίδων: OrderDeck Fleet branding + δυναμικό όνομα
// εταιρείας στο header. Δεν χρησιμοποιεί το AppShell των μαγαζιών.
export default function FleetShell({ title, children, actions = null }) {
  const { team, logout, exitMember } = useFleet();
  const navigate = useNavigate();
  const isAdmin = team && team.role === "fleet_admin";

  // Τίτλος tab: όνομα εταιρείας — OrderDeck Fleet
  useEffect(() => {
    const name = team && team !== false ? team.name : null;
    document.title = name ? `${name} — OrderDeck Fleet` : "OrderDeck Fleet";
    return () => {
      document.title = "OrderDeck — POS για την εστίασή σου";
    };
  }, [team]);

  const changeMember = async () => {
    await exitMember();
    navigate("/fleet/select");
  };

  return (
    <div className="min-h-screen bg-[#2A0E14] text-white">
      <header className="sticky top-0 z-40 bg-[#3D1620] border-b border-[#723645]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Truck className="w-5 h-5 text-flame shrink-0" />
          <div className="min-w-0">
            <div className="font-heading font-bold leading-tight truncate">
              {team && team !== false ? team.name : "OrderDeck Fleet"}
            </div>
            <div className="text-[11px] text-neutral-400 leading-tight">
              OrderDeck Fleet{team?.member_name ? ` · ${team.member_name}` : ""}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {actions}
            {isAdmin && (
              <>
                <Link
                  to="/fleet"
                  className="p-2 rounded-md hover:bg-white/5 text-neutral-300"
                  title="Πίνακας"
                  data-testid="fleet-nav-board"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Link>
                <Link
                  to="/fleet/members"
                  className="p-2 rounded-md hover:bg-white/5 text-neutral-300"
                  title="Μέλη"
                  data-testid="fleet-nav-members"
                >
                  <Users className="w-4 h-4" />
                </Link>
              </>
            )}
            <button
              onClick={changeMember}
              className="px-2 py-1.5 rounded-md hover:bg-white/5 text-xs text-neutral-300"
              data-testid="fleet-change-member"
            >
              Αλλαγή μέλους
            </button>
            <button
              onClick={() => {
                logout();
                navigate("/fleet/login");
              }}
              className="p-2 rounded-md hover:bg-white/5 text-neutral-300"
              title="Αποσύνδεση"
              data-testid="fleet-logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      {title && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <h1 className="font-heading text-xl font-bold">{title}</h1>
        </div>
      )}
      <main className="max-w-6xl mx-auto px-4 py-4">{children}</main>
    </div>
  );
}

import Sidebar from "../components/admin/Sidebar";

export const metadata = {
  title: "Truck Logging",
  description: "Truck Logging",
};
export default function DashboardLayout({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f4f6f9" }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, padding: "24px 28px 40px" }}>
        {children}
      </main>
    </div>
  );
}
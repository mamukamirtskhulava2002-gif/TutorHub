import ParentOnboardingModal from "@/components/ParentOnboardingModal";

export default function ParentLayout({ children }) {
  return (
    <>
      {children}
      <ParentOnboardingModal />
    </>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PasswordDialog from "@/components/PasswordDialog";

const Settings = () => {
  const [showPassword, setShowPassword] = useState(true);
  const navigate = useNavigate();

  const handlePasswordSuccess = () => {
    setShowPassword(false);
    navigate("/settings/general");
  };

  return (
    <>
      <PasswordDialog
        open={showPassword}
        onClose={() => navigate("/")}
        onSuccess={handlePasswordSuccess}
      />
    </>
  );
};

export default Settings;
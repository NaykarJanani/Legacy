import React, { useState } from "react";
import "./AdminEditorRegister.css";
import api from "../../../services/api";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useLoader } from "../../../context/LoaderContext";

export const AdminEditorRegister: React.FC = () => {
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    username: "",
    password: "",
  });
    const navigate = useNavigate();
  const { showLoader, hideLoader } = useLoader();

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^[0-9]{10}$/.test(formData.phone)) {
      newErrors.phone = "Enter a valid 10-digit phone number";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.trim().length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      toast.error("Please fix validation errors before submitting");
      return;
    }

    try {
        showLoader();
      const res = await api.post("/editor/create", formData); // ✅ update endpoint

      if (res.data.success) {
        toast.success("Editor created successfully!");
        setFormData({ name: "", address: "", phone: "", email: "", username: "", password: "" });
        navigate('/Admin/EditorManagement')
      } else {
        toast.error(res.data.message || "Something went wrong");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to create editor. Please try again.");
    }finally{
        hideLoader()
    }
  };

  return (
    <div className="editor-bg">
      <div className="editor-card">
        <h2 className="editor-title">Create Editor</h2>
        <p className="editor-desc">Enter details to add a new editor</p>

        <form className="editor-form" onSubmit={handleSubmit}>
          <div className="editor-field">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              placeholder="Enter Name"
              value={formData.name}
              onChange={handleChange}
            />
            {errors.name && <small className="error">{errors.name}</small>}
          </div>

          <div className="editor-field">
            <label htmlFor="address">Address</label>
            <input
              type="text"
              id="address"
              placeholder="Enter Address"
              value={formData.address}
              onChange={handleChange}
            />
            {errors.address && <small className="error">{errors.address}</small>}
          </div>

          <div className="editor-field">
            <label htmlFor="phone">Phone No</label>
            <input
              type="tel"
              id="phone"
              placeholder="Enter Phone Number"
              value={formData.phone}
              onChange={handleChange}
            />
            {errors.phone && <small className="error">{errors.phone}</small>}
          </div>

          <div className="editor-field">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="Enter Email"
              value={formData.email}
              onChange={handleChange}
            />
            {errors.email && <small className="error">{errors.email}</small>}
          </div>

          <div className="editor-field">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              placeholder="Enter Username (min 3 characters)"
              value={formData.username}
              onChange={handleChange}
              autoComplete="off"
            />
            {errors.username && <small className="error">{errors.username}</small>}
          </div>

          <div className="editor-field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="Enter Password (min 8 characters)"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
            {errors.password && <small className="error">{errors.password}</small>}
          </div>

          <button type="submit" className="editor-submit">Submit</button>
        </form>
      </div>
    </div>
  );
};

export default AdminEditorRegister;
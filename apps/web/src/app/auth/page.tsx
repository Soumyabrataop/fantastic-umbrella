"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import "./auth.css";

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp, loading: authLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSignUp(e.target.checked);
    // Reset form when switching
    setFormData({ name: "", email: "", password: "" });
    setError("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error } = await signIn(formData.email, formData.password);

      if (error) throw error;

      console.log("Login successful:", data);
      router.push("/feed");
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error } = await signUp(
        formData.email,
        formData.password,
        formData.name
      );

      if (error) throw error;

      console.log("Sign up successful:", data);

      // Check if email confirmation is required
      if (data.user && !data.session) {
        setError("Please check your email to confirm your account");
      } else {
        router.push("/feed");
      }
    } catch (err: any) {
      console.error("Sign up error:", err);
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-cream via-pink-100 to-purple-100 dark:from-background dark:via-gray-900 dark:to-purple-900 flex items-center justify-center p-4">
      <div className="wrapper">
        <div className="card-switch">
          <label className="switch">
            <input
              type="checkbox"
              className="toggle"
              checked={isSignUp}
              onChange={handleToggle}
            />
            <span className="slider"></span>
            <span className="card-side"></span>
            <div className="flip-card__inner">
              {/* Login Card - Front */}
              <div className="flip-card__front">
                <div className="title">Log in</div>
                <form className="flip-card__form" onSubmit={handleLogin}>
                  {error && !isSignUp && (
                    <div className="text-red-600 text-sm font-semibold px-2">
                      {error}
                    </div>
                  )}
                  <input
                    className="flip-card__input"
                    name="email"
                    placeholder="Email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                  />
                  <input
                    className="flip-card__input"
                    name="password"
                    placeholder="Password"
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                  />
                  <button
                    className="flip-card__btn"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Loading..." : "Let's go!"}
                  </button>
                </form>
              </div>

              {/* Sign Up Card - Back */}
              <div className="flip-card__back">
                <div className="title">Sign up</div>
                <form className="flip-card__form" onSubmit={handleSignUp}>
                  {error && isSignUp && (
                    <div className="text-red-600 text-sm font-semibold px-2">
                      {error}
                    </div>
                  )}
                  <input
                    className="flip-card__input"
                    name="name"
                    placeholder="Name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                  />
                  <input
                    className="flip-card__input"
                    name="email"
                    placeholder="Email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                  />
                  <input
                    className="flip-card__input"
                    name="password"
                    placeholder="Password"
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                  />
                  <button
                    className="flip-card__btn"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Loading..." : "Confirm!"}
                  </button>
                </form>
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

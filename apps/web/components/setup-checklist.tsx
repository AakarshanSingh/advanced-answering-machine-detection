"use client";

import { useState, useEffect } from "react";

interface CheckItem {
  id: string;
  label: string;
  status: "checking" | "success" | "error" | "warning";
  message?: string;
}

export function SetupChecklist() {
  const [checks, setChecks] = useState<CheckItem[]>([
    { id: "env", label: "Environment variables", status: "checking" },
    { id: "db", label: "Database connection", status: "checking" },
    { id: "twilio", label: "Twilio credentials", status: "checking" },
    { id: "ngrok", label: "ngrok URL configured", status: "checking" },
  ]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    const response = await fetch("/api/debug");
    const config = await response.json();

    const hasNgrok =
      config.ngrokUrl &&
      config.ngrokUrl !== "NOT SET" &&
      !config.ngrokUrl.includes("localhost");
    const hasTwilio =
      config.twilioAccountSid === "SET (hidden)" &&
      config.twilioAuthToken === "SET (hidden)";

    setChecks([
      {
        id: "env",
        label: "Environment variables",
        status: "success",
        message: ".env file loaded",
      },
      {
        id: "db",
        label: "Database connection",
        status: "success",
        message: "PostgreSQL connected",
      },
      {
        id: "twilio",
        label: "Twilio credentials",
        status: hasTwilio ? "success" : "warning",
        message: hasTwilio
          ? "Twilio credentials configured"
          : "Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set",
      },
      {
        id: "ngrok",
        label: "ngrok URL configured",
        status: hasNgrok ? "success" : "error",
        message: hasNgrok
          ? `ngrok: ${config.ngrokUrl}`
          : "⚠️ REQUIRED: Start ngrok and set NGROK_URL in .env",
      },
    ]);
  };

  const allSuccess = checks.every((c) => c.status === "success");
  const hasErrors = checks.some((c) => c.status === "error");

  if (allSuccess && !isExpanded) {
    return null;
  }

  return (
    <div
      className={`mb-6 rounded-lg border ${
        hasErrors
          ? "border-red-900 bg-red-950/10"
          : "border-yellow-900 bg-yellow-950/10"
      }`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center space-x-3">
          {hasErrors ? (
            <svg
              className="w-5 h-5 text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-yellow-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span className="font-medium text-white">
            {hasErrors ? "Setup Required" : "Setup Incomplete"}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-neutral-400 transform transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {checks.map((check) => (
            <div key={check.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {check.status === "checking" && (
                  <svg
                    className="animate-spin h-4 w-4 text-neutral-400"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                {check.status === "success" && (
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {check.status === "error" && (
                  <svg
                    className="w-4 h-4 text-red-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {check.status === "warning" && (
                  <svg
                    className="w-4 h-4 text-yellow-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{check.label}</p>
                {check.message && (
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {check.message}
                  </p>
                )}
              </div>
            </div>
          ))}

          {hasErrors && (
            <div className="mt-4 pt-3 border-t border-red-900">
              <p className="text-sm font-medium text-red-400 mb-2">
                Quick Fix:
              </p>
              <ol className="text-sm text-red-300 space-y-1 list-decimal list-inside">
                <li>
                  Run:{" "}
                  <code className="px-1 py-0.5 bg-red-950/50 rounded text-xs">
                    ngrok http 3000
                  </code>
                </li>
                <li>Copy the HTTPS URL (e.g., https://abc123.ngrok.io)</li>
                <li>
                  Add to apps/web/.env:{" "}
                  <code className="px-1 py-0.5 bg-red-950/50 rounded text-xs">
                    NGROK_URL="https://abc123.ngrok.io"
                  </code>
                </li>
                <li>Restart dev server</li>
              </ol>
              <a
                href="https://github.com/yourusername/advanced-answering-machine-detection/blob/main/NGROK_SETUP.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-sm text-red-400 underline hover:text-red-300"
              >
                View detailed setup guide →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

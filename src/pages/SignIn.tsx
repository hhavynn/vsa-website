import React from "react";
import { SignInForm } from "../components/Auth/SignInForm";

export default function SignIn() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-white">
            Welcome to VSA
          </h1>
          <p className="mt-2 text-center text-sm text-gray-300">
            Sign in to access member features
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <SignInForm />

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-300">
                  Membership Information
                </span>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-gray-400">
              <p>VSA membership is by invitation only.</p>
              <p className="mt-2">If you're interested in becoming a member,</p>
              <p className="mt-2">
                please connect with our cabinet members at one of our events!
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-400">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

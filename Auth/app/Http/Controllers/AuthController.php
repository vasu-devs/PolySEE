<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Tymon\JWTAuth\Facades\JWTAuth;
use Tymon\JWTAuth\Exceptions\JWTException;

class AuthController extends Controller
{
    /**
     * GET /auth/health
     */
    public function health()
    {
        Log::info('Health check called');

        return response()->json([
            'status' => 'Auth service is running',
            'timestamp' => now()->toISOString(),
        ]);
    }

    /**
     * POST /auth/register
     * Expects: { regNo, password, role }
     */
    public function register(Request $request)
    {
        $regNo = $request->input('regNo');
        $password = $request->input('password');
        $role = $request->input('role');

        // Validate required fields
        if (!$regNo || !$password || !$role) {
            Log::warning('Failed registration attempt - Missing fields');
            return response()->json([
                'error' => 'Missing required fields: regNo, password, role',
            ], 400);
        }

        // Validate role
        if (!in_array($role, ['user', 'admin'])) {
            Log::warning("Invalid role '{$role}' attempted for regNo: {$regNo}");
            return response()->json([
                'error' => "Role must be 'user' or 'admin'",
            ], 400);
        }

        // Check if user already exists
        $existingUser = User::where('reg_no', $regNo)->first();
        if ($existingUser) {
            Log::warning("Registration failed - User already exists: {$regNo}");
            return response()->json([
                'error' => 'User with this registration number already exists',
            ], 409);
        }

        // Create new user
        $user = User::create([
            'reg_no' => $regNo,
            'password' => Hash::make($password),
            'role' => $role,
        ]);

        Log::info("New user registered: {$regNo}, role: {$role}");

        return response()->json([
            'message' => 'User registered successfully',
            'regNo' => $user->reg_no,
            'role' => $user->role,
        ], 201);
    }

    /**
     * POST /auth/login
     * Expects: { regNo, password }
     */
    public function login(Request $request)
    {
        $regNo = $request->input('regNo');
        $password = $request->input('password');

        if (!$regNo || !$password) {
            Log::warning('Login attempt with missing fields');
            return response()->json(['error' => 'missing fields'], 400);
        }

        $user = User::where('reg_no', $regNo)->first();
        if (!$user) {
            Log::warning("Invalid login attempt - User not found: {$regNo}");
            return response()->json(['error' => 'invalid credentials'], 401);
        }

        if (!Hash::check($password, $user->password)) {
            Log::warning("Invalid login attempt - Wrong password for {$regNo}");
            return response()->json(['error' => 'invalid credentials'], 401);
        }

        $token = JWTAuth::fromUser($user);

        Log::info("User logged in: {$regNo}, role: {$user->role}");

        return response()->json([
            'token' => $token,
            'regNo' => $user->reg_no,
            'role' => $user->role,
        ]);
    }

    /**
     * GET /auth/me
     * Verify JWT token and return payload
     */
    public function me(Request $request)
    {
        $authHeader = $request->header('Authorization');
        if (!$authHeader) {
            Log::warning('Token verification failed - Missing Authorization header');
            return response('', 401);
        }

        try {
            $payload = JWTAuth::parseToken()->getPayload();

            Log::info("Token verified for user: {$payload->get('regNo')}");

            return response()->json([
                'regNo' => $payload->get('regNo'),
                'role' => $payload->get('role'),
                'iat' => $payload->get('iat'),
                'exp' => $payload->get('exp'),
            ]);
        } catch (JWTException $e) {
            Log::warning('Token verification failed - Invalid/Expired token');
            return response('', 401);
        }
    }
}

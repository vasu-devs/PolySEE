<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tymon\JWTAuth\Facades\JWTAuth;

class ChatController extends Controller
{
    /**
     * GET /api/user/recent-chats
     * Get authenticated user's chat history
     */
    public function recentChats(Request $request)
    {
        $user = JWTAuth::parseToken()->authenticate();

        $chats = $user->chats()->orderBy('created_at', 'desc')->get();

        // Map to camelCase keys matching the Node.js MongoDB output
        $recentChats = $chats->map(function ($chat) {
            return [
                'query' => $chat->query,
                'response' => $chat->response,
                'success' => $chat->success,
                'responseTimeMs' => $chat->response_time_ms,
                'language' => $chat->language,
                'category' => $chat->category,
                'createdAt' => $chat->created_at->toISOString(),
            ];
        });

        return response()->json([
            'recentChats' => $recentChats,
        ]);
    }

    /**
     * POST /api/chat
     * Forward query to FastAPI and save chat
     */
    public function chat(Request $request)
    {
        $query = $request->input('query');
        $user = JWTAuth::parseToken()->authenticate();

        try {
            $fastapiUrl = env('FASTAPI_URL', 'http://localhost:8000');

            $resp = Http::withHeaders([
                'Authorization' => $request->header('Authorization'),
            ])->post("{$fastapiUrl}/v1/chat", [
                'query' => $query,
            ]);

            $data = $resp->json();

            $answer = $data['answer'] ?? '';
            $success = $data['success'] ?? true;
            $responseTimeMs = $data['responseTimeMs'] ?? 0;
            $language = $data['language'] ?? 'en';
            $category = $data['category'] ?? 'general';

            // Save chat to database
            $user->chats()->create([
                'query' => $query,
                'response' => $answer,
                'success' => $success,
                'response_time_ms' => $responseTimeMs,
                'language' => $language,
                'category' => $category,
            ]);

            return response()->json([
                'answer' => $answer,
                'success' => $success,
                'responseTimeMs' => $responseTimeMs,
                'language' => $language,
                'category' => $category,
            ]);
        } catch (\Exception $e) {
            Log::error('Chat forwarding failed: ' . $e->getMessage());
            return response()->json(['error' => 'ai-failed'], 500);
        }
    }
}

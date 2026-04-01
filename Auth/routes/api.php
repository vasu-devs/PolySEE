<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatController;

// Auth routes (public)
Route::prefix('auth')->group(function () {
    Route::get('/health', [AuthController::class, 'health']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/me', [AuthController::class, 'me']);
});

// Protected API routes
Route::prefix('api')->middleware('jwt.verify:user,admin')->group(function () {
    Route::get('/user/recent-chats', [ChatController::class, 'recentChats']);
    Route::post('/chat', [ChatController::class, 'chat']);
});

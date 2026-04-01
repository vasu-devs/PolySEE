@extends('layouts.app')

@section('title', 'Auth Service - API Documentation')

@section('content')
    <h1>Auth Service API</h1>
    <h2>MVC Architecture with Laravel</h2>

    <div class="card">
        <h3 style="margin-bottom: 1rem; color: #f1f5f9;">MVC Components</h3>
        <p><strong>Models:</strong> User, Chat, UploadedFile (Eloquent ORM with SQLite)</p>
        <p><strong>Views:</strong> Blade templates (this page, login page) + JSON API responses</p>
        <p><strong>Controllers:</strong> AuthController, ChatController</p>
    </div>

    <h3 style="margin: 1.5rem 0 1rem; color: #f1f5f9;">API Endpoints</h3>

    <div class="card">
        <span class="badge badge-get">GET</span> <code>/auth/health</code>
        <p style="margin-top: 0.5rem; color: #94a3b8;">Health check - returns service status and timestamp</p>
    </div>

    <div class="card">
        <span class="badge badge-post">POST</span> <code>/auth/register</code>
        <p style="margin-top: 0.5rem; color: #94a3b8;">Register a new user with regNo, password, and role</p>
    </div>

    <div class="card">
        <span class="badge badge-post">POST</span> <code>/auth/login</code>
        <p style="margin-top: 0.5rem; color: #94a3b8;">Login and receive a JWT token</p>
    </div>

    <div class="card">
        <span class="badge badge-get">GET</span> <code>/auth/me</code>
        <p style="margin-top: 0.5rem; color: #94a3b8;">Verify JWT token and return user payload</p>
    </div>

    <div class="card">
        <span class="badge badge-get">GET</span> <code>/api/user/recent-chats</code>
        <p style="margin-top: 0.5rem; color: #94a3b8;">Get authenticated user's chat history (protected)</p>
    </div>

    <div class="card">
        <span class="badge badge-post">POST</span> <code>/api/chat</code>
        <p style="margin-top: 0.5rem; color: #94a3b8;">Send a query to the AI assistant (protected)</p>
    </div>
@endsection

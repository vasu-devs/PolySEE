<?php

use Illuminate\Support\Facades\Route;

// Blade views for MVC demonstration
Route::get('/', function () {
    return view('welcome');
});

Route::get('/login-page', function () {
    return view('auth.login');
});

-keepclassmembers class com.solo.app.bridge.WebViewBridge {
    @android.webkit.JavascriptInterface <methods>;
}

-keepattributes JavascriptInterface

-keep class com.solo.app.bridge.WebViewBridge { *; }

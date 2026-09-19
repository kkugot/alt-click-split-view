# Runtime validation

`zen-runtime.py` requires Sine and Alt-click Split View registered in the dedicated `hidden-space-zen-test` profile. It uses Marionette in chrome context to send the same payload as Zen's `ClickHandler` parent actor, then checks native Split View creation, normal-click fallback, and unload restoration.

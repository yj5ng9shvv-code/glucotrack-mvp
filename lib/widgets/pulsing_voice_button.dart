import 'package:flutter/material.dart';

class PulsingVoiceButton extends StatefulWidget {
  final double size;
  final double iconSize;
  final bool listening;
  final bool enabled;
  final VoidCallback? onPressed;
  final String? semanticLabel;

  const PulsingVoiceButton({
    super.key,
    this.size = 64,
    this.iconSize = 30,
    this.listening = false,
    this.enabled = true,
    this.onPressed,
    this.semanticLabel,
  });

  @override
  State<PulsingVoiceButton> createState() => _PulsingVoiceButtonState();
}

class _PulsingVoiceButtonState extends State<PulsingVoiceButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
    animationBehavior: AnimationBehavior.preserve,
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: widget.onPressed != null,
      enabled: widget.enabled,
      label: widget.semanticLabel,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final phase = _controller.value;
          final scale =
              widget.listening ? 1 + phase * 0.065 : 0.97 + phase * 0.045;
          final start = Color.lerp(
            const Color(0xFF00D4FF),
            const Color(0xFF7B61FF),
            phase,
          )!;
          final middle = Color.lerp(
            const Color(0xFF2864FF),
            const Color(0xFFC33CFF),
            phase,
          )!;
          return Transform.scale(
            scale: scale,
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Color.lerp(
                      const Color(0x664B7BEC),
                      const Color(0x667B61FF),
                      phase,
                    )!,
                    blurRadius: 16 + phase * 14,
                    spreadRadius: 2 + phase * 5,
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                shape: const CircleBorder(),
                clipBehavior: Clip.antiAlias,
                child: Ink(
                  width: widget.size,
                  height: widget.size,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: widget.enabled
                          ? widget.listening
                              ? const [Color(0xFFFF5277), Color(0xFFB33CDB)]
                              : [start, middle, const Color(0xFF8B5CF6)]
                          : const [Color(0xFF9AA4B2), Color(0xFF667085)],
                    ),
                  ),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: widget.enabled ? widget.onPressed : null,
                    child: Icon(
                      widget.listening ? Icons.stop_rounded : Icons.mic_rounded,
                      size: widget.iconSize,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

import 'package:flutter/material.dart';

class ResponsiveTwoColumnList extends StatelessWidget {
  final EdgeInsetsGeometry? padding;
  final List<Widget> children;
  final double breakpoint;
  final List<int>? wideLeftOrder;
  final List<int>? wideRightOrder;
  final bool wideLastChildOnRight;

  const ResponsiveTwoColumnList({
    super.key,
    this.padding,
    required this.children,
    this.breakpoint = 820,
    this.wideLeftOrder,
    this.wideRightOrder,
    this.wideLastChildOnRight = false,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < breakpoint) {
          return ListView(padding: padding, children: children);
        }

        final content = children.where((child) => child is! SizedBox).toList();
        Widget spaced(Widget child) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: child,
            );
        final hasLastChildLayout = wideLastChildOnRight && content.length > 1;
        final hasCustomOrder = wideLeftOrder != null && wideRightOrder != null;
        final left = hasCustomOrder
            ? wideLeftOrder!
                .where((index) => index >= 0 && index < content.length)
                .map((index) => spaced(content[index]))
                .toList()
            : <Widget>[];
        final right = hasCustomOrder
            ? wideRightOrder!
                .where((index) => index >= 0 && index < content.length)
                .map((index) => spaced(content[index]))
                .toList()
            : <Widget>[];
        if (hasLastChildLayout && !hasCustomOrder) {
          left.addAll(content.take(content.length - 1).map(spaced));
          right.add(spaced(content.last));
        } else if (!hasCustomOrder) {
          for (var index = 0; index < content.length; index++) {
            (index.isEven ? left : right).add(spaced(content[index]));
          }
        }

        return ListView(
          padding: padding ?? const EdgeInsets.all(10),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: left,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: right,
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }
}

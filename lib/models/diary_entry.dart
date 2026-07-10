enum DiaryEntryType { fasting, beforeMeal, afterMeal, bedtime }

class DiaryEntry {
  final DateTime time;
  final double glucoseMmol;
  final DiaryEntryType type;
  final int carbs;
  final double insulinUnits;
  final String note;

  const DiaryEntry({
    required this.time,
    required this.glucoseMmol,
    required this.type,
    required this.carbs,
    required this.insulinUnits,
    required this.note,
  });
}

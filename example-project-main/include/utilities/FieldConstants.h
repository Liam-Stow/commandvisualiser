#pragma once

#include <frc/geometry/Translation2d.h>
#include <frc/geometry/Translation3d.h>
#include <frc/geometry/Pose2d.h>

namespace fieldpos {
constexpr frc::Translation2d BLUE_ALLIANCE_ZONE_TOP_RIGHT{4.2_m, 8_m};
constexpr frc::Translation2d BLUE_ALLIANCE_ZONE_BOTTOM_LEFT{0_m, 0_m};

constexpr frc::Translation2d TOP_PASSING_ZONE_TOP_RIGHT{16.5_m, 8_m};
constexpr frc::Translation2d TOP_PASSING_ZONE_BOTTOM_LEFT{4.2_m, 4_m};

constexpr frc::Translation2d BOTTOM_PASSING_ZONE_TOP_RIGHT{16.5_m, 4_m};
constexpr frc::Translation2d BOTTOM_PASSING_ZONE_BOTTOM_LEFT{4.2_m, 0_m};

constexpr frc::Translation3d HUB_POSITION{4.625_m, 4.018_m, 0_m};

constexpr frc::Translation3d TOP_ALLIANCE_ZONE_POSITION{2.5_m, 5.5_m, 0_m};
constexpr frc::Translation3d BOTTOM_ALLIANCE_ZONE_POSITION{2.5_m, 2.75_m, 0_m};

/* AUTON POSITIONS */
// Starting positions
constexpr frc::Pose2d START_BUMP_LEFT{3.58_m, 5.77_m, 0_deg};
constexpr frc::Pose2d START_TRENCH_LEFT{3.58_m, 7.47_m, 270_deg};
constexpr frc::Pose2d START_BUMP_RIGHT{3.58_m, 2.27_m, 0_deg};
constexpr frc::Pose2d START_TRENCH_RIGHT{3.58_m, 0.57_m, 90_deg};

// Neutral zone one pass positions
constexpr frc::Pose2d NEUTRAL_ONEPASS_IN_LEFT{7.80_m, 7.00_m, 270_deg};
constexpr frc::Pose2d NEUTRAL_ONEPASS_END_LEFT{7.80_m, 4.75_m, 270_deg};
constexpr frc::Pose2d NEUTRAL_ONEPASS_IN_RIGHT{7.80_m, 1.04_m, 90_deg};
constexpr frc::Pose2d NEUTRAL_ONEPASS_END_RIGHT{7.80_m, 3.29_m, 90_deg};

// Neutral zone two pass positions, left side
constexpr frc::Pose2d NEUTRAL_FIRSTPASS_IN_LEFT{8.70_m, 7.00_m, 270_deg};
constexpr frc::Pose2d NEUTRAL_FIRSTPASS_END_LEFT{8.70_m, 4.50_m, 270_deg};
constexpr frc::Pose2d NEUTRAL_FIRSTPASS_TRANS_LEFT{7.80_m, 7.00_m, 225_deg};

constexpr frc::Pose2d TWOPASS_TRENCH_RETURN_LEFT{3.58_m, 7.50_m, 225_deg};

constexpr frc::Pose2d NEUTRAL_SECONDPASS_IN_LEFT{5.90_m, 7.30_m, 270_deg};
constexpr frc::Pose2d NEUTRAL_SECONDPASS_END_LEFT{5.90_m, 3.50_m, 270_deg};
constexpr frc::Pose2d NEUTRAL_SECONDPASS_TRANS_LEFT{6.40_m, 4.70_m, 90_deg};

// Neutral zone two pass positions, right side
constexpr frc::Pose2d NEUTRAL_FIRSTPASS_IN_RIGHT{8.70_m, 1.04_m, 90_deg};
constexpr frc::Pose2d NEUTRAL_FIRSTPASS_END_RIGHT{8.70_m, 3.54_m, 90_deg};
constexpr frc::Pose2d NEUTRAL_FIRSTPASS_TRANS_RIGHT{7.80_m, 1.04_m, 135_deg};

constexpr frc::Pose2d TWOPASS_TRENCH_RETURN_RIGHT{3.58_m, 0.54_m, 135_deg};

constexpr frc::Pose2d NEUTRAL_SECONDPASS_IN_RIGHT{5.90_m, 0.74_m, 90_deg};
constexpr frc::Pose2d NEUTRAL_SECONDPASS_END_RIGHT{5.90_m, 4.54_m, 90_deg};
constexpr frc::Pose2d NEUTRAL_SECONDPASS_TRANS_RIGHT{6.40_m, 3.34_m, 270_deg};

// Alliance zone re-entry positions
constexpr frc::Pose2d START_REENTRY_BUMP_LEFT{5.85_m, 5.40_m, 180_deg};
constexpr frc::Pose2d START_REENTRY_TRENCH_LEFT{5.70_m, 7.50_m, 90_deg};
constexpr frc::Pose2d START_REENTRY_BUMP_RIGHT{5.85_m, 2.64_m, 180_deg};
constexpr frc::Pose2d START_REENTRY_TRENCH_RIGHT{5.70_m, 0.54_m, 270_deg};

constexpr frc::Pose2d END_REENTRY_TRENCH_LEFT{3.50_m, 7.25_m, 90_deg};
constexpr frc::Pose2d END_REENTRY_TRENCH_RIGHT{3.50_m, 0.79_m, 270_deg};

// Alliance zone positions
constexpr frc::Pose2d DEPOT_IN{1.33_m, 5.96_m, 180_deg};
constexpr frc::Pose2d DEPOT_END{0.75_m, 5.96_m, 180_deg};
constexpr frc::Pose2d OUTPOST{0.60_m, 0.67_m, 0_deg};
constexpr frc::Pose2d TOWER{1.65_m, 3.75_m, 0_deg};
}  // namespace fieldpos
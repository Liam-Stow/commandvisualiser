#pragma once

#include <ctre/phoenix6/signals/SpnEnums.hpp>
#include <rev/config/SparkBaseConfig.h>
#include <units/current.h>
#include <units/time.h>
#include <units/voltage.h>

namespace NeoMotorConfig {
constexpr double P = 16;
constexpr double I = 0;
constexpr double D = 8;
constexpr double S = 0.6;
constexpr double GEAR_RATIO = (56.0 / 8.0) * (370.0 / 34.0);

constexpr int CURRENT_LIMT = 30;

constexpr bool INVERTED = true;

constexpr rev::spark::SparkBaseConfig::IdleMode IDLE_MODE =
  rev::spark::SparkBaseConfig::IdleMode::kBrake;
};  // namespace NeoMotorConfig

namespace KrakenMotorConfig {
constexpr double P = 200;
constexpr double I = 0;
constexpr double D = 0;
constexpr double S = 0.6;
constexpr double G = 0.25;


constexpr double GEAR_RATIO = 34.83;

/* STATOR_CURRENT_LIMIT is the amount of current allowed inside the motor at
 * once. SUPPLY_CURRENT_LIMIT is true maximum current supplied to the motor
 * at once. SUPPLY_CURRENT_LOWER_LIMT is the typical supply current limit.
 * However, it can exceed it, up to the true maximum for
 * SUPPLY_CURRENT_LOWER_TIME seconds. */
constexpr units::ampere_t SUPPLY_CURRENT_LIMT = 40_A;
constexpr units::ampere_t SUPPLY_CURRENT_LOWER_LIMIT = 35_A;
constexpr units::ampere_t STATOR_CURRENT_LIMIT = 60_A;
constexpr ctre::phoenix6::signals::GravityTypeValue GRAVITY_TYPE = ctre::phoenix6::signals::GravityTypeValue::Elevator_Static;

constexpr units::second_t SUPPLY_CURRENT_LOWER_TIME = 0.1_s;

constexpr bool ENABLE_SUPPLY_CURRENT_LIMIT = true;
constexpr bool ENABLE_STATOR_CURRENT_LIMIT = true;
constexpr bool ENABLE_FOC = true;

constexpr ctre::phoenix6::signals::InvertedValue INVERTED =
  ctre::phoenix6::signals::InvertedValue::Clockwise_Positive;
constexpr ctre::phoenix6::signals::NeutralModeValue IDLE_MODE =
  ctre::phoenix6::signals::NeutralModeValue::Brake;
};  // namespace KrakenMotorConfig
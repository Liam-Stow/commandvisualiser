#include "utilities/ShiftHandler.h"

#include "utilities/Logger.h"

void ShiftHandler::Periodic() {
  Logger::Log("RebuiltShift/Hub Active", IsActiveShift());
  Logger::Log("RebuiltShift/Won Auton Shift", GetShiftName(GetWinningShift()));
  Logger::Log("RebuiltShift/Current Shift", GetShiftName(GetCurrentShift()));
  Logger::Log("RebuiltShift/Seconds Left on Shift", GetTimeLeft());
  Logger::Log("RebuiltShift/Seconds Left in Match", frc::DriverStation::GetMatchTime());
  Logger::Log("RebuiltShift/Override Active", _overrideActive);
  Logger::Log("RebuiltShift/Start shift offset", _beforeShiftOffset);
  Logger::Log("RebuiltShift/End shift offset", _afterShiftOffset);
  Logger::Log("RebuiltShift/GetCurrentShift/timeLeft", 140_s - getTimer());
}

RebuiltShift ShiftHandler::GetCurrentShift() {
  if (frc::DriverStation::IsAutonomousEnabled()) {
    return RebuiltShift::AUTON;
  }

  units::second_t timeLeft = 140_s - getTimer();

  if (timeLeft == -1_s) { /* Isn't in home practise mode */
    return RebuiltShift::NONE;
  }

  if (timeLeft > 130_s - _afterShiftOffset) {
    return RebuiltShift::TRANS;
  }

  RebuiltShift losingShift, winningShift = GetWinningShift();
  if (winningShift == RebuiltShift::NONE) {
    losingShift = RebuiltShift::NONE;
  } else { /* filps RebuiltShift::BLUE to RebuiltShift::RED and vice versa*/
    losingShift = (winningShift == RebuiltShift::BLUE ? RebuiltShift::RED : RebuiltShift::BLUE);
  }

  units::second_t losingShiftOffset;
  units::second_t winningShiftOffset;

  RebuiltShift myShift = static_cast<RebuiltShift>(
    frc::DriverStation::GetAlliance().value_or(frc::DriverStation::Alliance::kBlue));

  if (myShift == losingShift) {
    losingShiftOffset = -_afterShiftOffset;
    winningShiftOffset = _beforeShiftOffset;
  } else {
    losingShiftOffset = _beforeShiftOffset;
    winningShiftOffset = -_afterShiftOffset;
  }

  if (timeLeft > 105_s + losingShiftOffset) { /* Shift 1 */
    return losingShift;
  }
  if (timeLeft > 80_s + winningShiftOffset) { /* Shift 2 */
    return winningShift;
  }
  if (timeLeft > 55_s + losingShiftOffset) { /* Shift 3 */
    return losingShift;
  }
  if (timeLeft > 30_s + winningShiftOffset) { /* Shift 4 */
    return winningShift;
  }
  return RebuiltShift::ENDGAME;
}

RebuiltShift ShiftHandler::GetWinningShift() {
  if (_overrideActive == true) {
    return static_cast<RebuiltShift>(
      frc::DriverStation::GetAlliance().value_or(frc::DriverStation::Alliance::kBlue));
  }

  std::string data = frc::DriverStation::GetGameSpecificMessage();
  if (data.length() == 0) { /* No winning shift message recieved */
    return RebuiltShift::NONE;
  }

  switch (data[0]) {
    case 'B':
      return RebuiltShift::BLUE;
    case 'R':
      return RebuiltShift::RED;
  }

  return RebuiltShift::NONE; /* Corrupt data */
}

units::second_t ShiftHandler::GetTimeLeft() {
  units::second_t matchTime = frc::DriverStation::GetMatchTime();
  if (frc::DriverStation::IsAutonomousEnabled()) {
    return matchTime;
  }

  if (matchTime > 130_s) {
    return matchTime - 130_s;
  }
  if (matchTime > 105_s) { /* Shift 1 */
    return matchTime - 105_s;
  }
  if (matchTime > 80_s) { /* Shift 2 */
    return matchTime - 80_s;
  }
  if (matchTime > 55_s) { /* Shift 3 */
    return matchTime - 55_s;
  }
  if (matchTime > 30_s) { /* Shift 4 */
    return matchTime - 30_s;
  }
  return matchTime;
}

std::string ShiftHandler::GetShiftName(RebuiltShift shift) {
  switch (shift) {
    case RebuiltShift::AUTON:
      return "Autonomous";
    case RebuiltShift::TRANS:
      return "Transition";
    case RebuiltShift::BLUE:
      return "Blue";
    case RebuiltShift::RED:
      return "Red";
    case RebuiltShift::ENDGAME:
      return "Endgame";
    default:
      return "None";
  }
}

bool ShiftHandler::GetOverrideActive() {
  return _overrideActive;
}

bool ShiftHandler::IsShift(RebuiltShift shift) {
  return GetCurrentShift() == shift ? true : false; /* check if matching */
}

bool ShiftHandler::IsActiveShift() {
  if (_overrideActive == true) {
    return true;
  }
  if (frc::DriverStation::IsFMSAttached() == false && /* Isn't at comp? */
      frc::DriverStation::GetMatchTime() == -1_s &&   /* Isn't home practise mode */
      frc::DriverStation::IsDisabled() == false       /* Isn't disabled */
  ) {
    return true; /* Don't respect shifts */
  }
  RebuiltShift currentShift = GetCurrentShift();
  RebuiltShift myShift = static_cast<RebuiltShift>(
    frc::DriverStation::GetAlliance().value_or(frc::DriverStation::Alliance::kBlue));

  if (currentShift == RebuiltShift::AUTON || currentShift == RebuiltShift::TRANS ||
      currentShift == RebuiltShift::ENDGAME || myShift == currentShift) {
    return true;
  }
  return false;
}

void ShiftHandler::SetOverrideActive(bool isActive) {
  _overrideActive = isActive;
}

void ShiftHandler::SetTOFOffset(units::second_t TOF) {
  _tof = TOF;
  _beforeShiftOffset = TOF;
  _afterShiftOffset = _baseOffset - TOF;
}

void ShiftHandler::resetTimer() {
  _teleopTimer.Restart();
}

units::second_t ShiftHandler::getTimer() {
  return _teleopTimer.Get();
}
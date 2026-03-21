#include <frc/DriverStation.h>

#include <units/time.h>
#include <frc/Timer.h>

enum RebuiltShift {
  RED = 0, /* set to match frc::DriverStation::Alliance */
  BLUE = 1,
  AUTON = 2,
  TRANS = 3,
  ENDGAME = 4,
  NONE = 5,
};

class ShiftHandler {
 public:
  static ShiftHandler& GetInstance() {
    static ShiftHandler inst;
    return inst;
  }
  
  void resetTimer();
  units::second_t getTimer();

  /* Logging */
  void Periodic();

  /* Getters */
  RebuiltShift GetCurrentShift();
  RebuiltShift GetWinningShift();
  units::second_t GetTimeLeft();
  std::string GetShiftName(RebuiltShift shift);
  bool GetOverrideActive();
  bool IsShift(RebuiltShift shift);
  bool IsActiveShift();

  /* Setters */
  void SetOverrideActive(bool isActive);
  void SetTOFOffset(units::second_t TOF);

  /*Delete assignment and copy so people don't accidently create copies*/
  ShiftHandler(ShiftHandler const&) = delete;
  void operator=(ShiftHandler const&) = delete;

 private:
  bool _overrideActive = false;
  units::second_t _baseOffset = 3_s;
  units::second_t _beforeShiftOffset = 0_s;
  units::second_t _afterShiftOffset = 0_s;
  units::second_t _tof = 0_s;
  frc::Timer _teleopTimer;

  /*Private constructor to prevent creating multiple instances*/
  ShiftHandler() {}
};
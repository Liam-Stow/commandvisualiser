#include "utilities/AutonHelper.h"


namespace AutonHelper{
    AutonPtr MakePathPlannerAuto(pathplanner::PathPlannerAuto auton) {
        /* An AutonPtr is just a shared_ptr to a CommandPtr*/
        return std::make_shared<frc2::CommandPtr>(std::move(auton).ToPtr());
    }

    AutonPtr MakeCommandPtrAuto(frc2::CommandPtr auton) {
        return std::make_shared<frc2::CommandPtr>(std::move(auton));
    }

    void AutonManager::AddAuton(std::string autoname, AutonPtr autonptr) {
        _autoChooser.AddOption(autoname, autonptr);
    }

    void AutonManager::AddDefaultAuton(std::string autoname, AutonPtr autonptr) {
        _autoChooser.SetDefaultOption(autoname, autonptr);
    }

    AutonChooser& AutonManager::GetAutonChooser() {
        AutonChooser& chooser = _autoChooser;
        return chooser;
    }

    AutonPtr AutonManager::GetChosenAuton() {
        return _autoChooser.GetSelected().lock();
    }
}
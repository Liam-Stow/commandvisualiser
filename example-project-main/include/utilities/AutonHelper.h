#pragma once

#include <pathplanner/lib/commands/PathPlannerAuto.h>
#include <frc2/command/CommandPtr.h>
#include <frc/smartdashboard/SendableChooser.h>

namespace AutonHelper {
    typedef std::shared_ptr<frc2::CommandPtr> AutonPtr;
    typedef frc::SendableChooser<AutonPtr> AutonChooser;
    AutonPtr MakePathPlannerAuto(pathplanner::PathPlannerAuto auton);
    AutonPtr MakeCommandPtrAuto(frc2::CommandPtr auton);
    
    class AutonManager {
        public:
            void AddAuton(std::string autoname, AutonPtr autoptr);
            void AddDefaultAuton(std::string autoname, AutonPtr autoptr);
            AutonChooser& GetAutonChooser();
            AutonPtr GetChosenAuton();
        private:
            AutonChooser _autoChooser;
    };
}
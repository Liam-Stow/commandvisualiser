#include "TurretEncoderIO.h"
#include <frc/DutyCycleEncoder.h>

class TurretThroughboreIO : public TurretEncoderIO {
    public:
        TurretThroughboreIO(int encoder1CanID, int encoder2CanID);
        void ConfigEncoder();
        units::degree_t GetEncoder1Degrees();
        units::degree_t GetEncoder2Degrees();
        units::degree_t GetRawEncoder1();
        units::degree_t GetRawEncoder2();
        bool IsConnected();
    private:
        frc::DutyCycleEncoder _encoder1;
        frc::DutyCycleEncoder _encoder2;
};
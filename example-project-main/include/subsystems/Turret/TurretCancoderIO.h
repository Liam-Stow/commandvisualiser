#include "TurretEncoderIO.h"
#include <ctre/phoenix6/CANcoder.hpp>

class TurretCancoderIO : public TurretEncoderIO {
    public:
        TurretCancoderIO(int encoder1CanID, int encoder2CanID);
        void ConfigEncoder();
        units::degree_t GetEncoder1Degrees();
        units::degree_t GetEncoder2Degrees();
        units::degree_t GetRawEncoder1();
        units::degree_t GetRawEncoder2();
        bool IsConnected();
    private:
        ctre::phoenix6::hardware::CANcoder _encoder1;
        ctre::phoenix6::hardware::CANcoder _encoder2;
        ctre::phoenix6::configs::CANcoderConfiguration _encoderConfig;
};
use crate::models::device::{
    BatteryInfo,
    BatteryHealth
};

pub fn calculate(
    battery: &BatteryInfo
)
-> BatteryHealth
{
    let health_percent =
        if battery.design_capacity_mwh > 0
        {
            (
                battery
                    .full_charge_capacity_mwh
                    as f64

                /

                battery
                    .design_capacity_mwh
                    as f64
            )
            * 100.0
        }
        else
        {
            0.0
        };

    BatteryHealth {

        health_percent,
    }
}
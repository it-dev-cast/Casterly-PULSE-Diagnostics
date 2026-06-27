use std::io;
use std::process::Command;

use crate::models::device::
    WebcamTest;

pub fn run()
-> WebcamTest
{
    println!();

    println!("======================");
    println!("WEBCAM TEST");
    println!("======================");

    println!();

    println!(
        "Opening Webcam Preview..."
    );

    println!(
        "Close the preview window when done."
    );

    println!();

    let _ =
        Command::new("ffplay")
            .args([
                "-f",
                "v4l2",
                "-i",
                "/dev/video0"
            ])
            .status();

    println!();

    println!(
        "Did Webcam Test Pass?"
    );

    println!(
        "1. PASS"
    );

    println!(
        "2. FAIL"
    );

    let mut choice =
        String::new();

    io::stdin()
        .read_line(
            &mut choice
        )
        .unwrap();

    let result =
        if choice.trim() == "1"
    {
        "PASS"
    }
    else
    {
        "FAIL"
    };

    WebcamTest {

        result:
            result.to_string(),
    }
}
use std::io;

use crate::models::device::
    ManualGrading;

pub fn collect()
-> ManualGrading
{
    println!();

    println!("======================");
    println!("MANUAL GRADING");
    println!("======================");

    let lcd_status =
        ask_pass_fail(
            "LCD"
        );

    let mut lcd_defects =
        Vec::<String>::new();

    if lcd_status == "FAIL"
    {
        println!();

        println!(
            "LCD Defects"
        );

        println!(
            "1. Patch"
        );

        println!(
            "2. Spot"
        );

        println!(
            "3. Keyboard Impression"
        );

        println!(
            "4. Line"
        );

        println!(
            "5. Broken"
        );

        println!();

        println!(
            "Enter numbers separated by comma:"
        );

        let mut input =
            String::new();

        io::stdin()
            .read_line(
                &mut input
            )
            .unwrap();

        for item in
            input.trim().split(',')
        {
            match item.trim()
            {
                "1" =>
                    lcd_defects.push(
                        "Patch"
                        .to_string()
                    ),

                "2" =>
                    lcd_defects.push(
                        "Spot"
                        .to_string()
                    ),

                "3" =>
                    lcd_defects.push(
                        "Keyboard Impression"
                        .to_string()
                    ),

                "4" =>
                    lcd_defects.push(
                        "Line"
                        .to_string()
                    ),

                "5" =>
                    lcd_defects.push(
                        "Broken"
                        .to_string()
                    ),

                _ => {}
            }
        }
    }

    let top_cover_status =
        ask_pass_fail(
            "Top Cover"
        );

    let bezel_status =
        ask_pass_fail(
            "Bezel"
        );

    let palmrest_status =
        ask_pass_fail(
            "Palmrest"
        );

    let bottom_cover_status =
        ask_pass_fail(
            "Bottom Cover"
        );

    let keyboard_status =
        ask_pass_fail(
            "Keyboard"
        );

    let touchpad_status =
        ask_pass_fail(
            "Touchpad"
        );

    println!();

    println!("Remarks:");

    let mut remarks =
        String::new();

    io::stdin()
        .read_line(
            &mut remarks
        )
        .unwrap();

    ManualGrading {

        lcd_status,

        lcd_defects,

        top_cover_status,

        bezel_status,

        palmrest_status,

        bottom_cover_status,

        keyboard_status,

        touchpad_status,

        remarks:
            remarks
                .trim()
                .to_string(),
    }
}

fn ask_pass_fail(
    name: &str
)
-> String
{
    println!();

    println!("{}", name);

    println!("1. PASS");

    println!("2. FAIL");

    let mut input =
        String::new();

    io::stdin()
        .read_line(
            &mut input
        )
        .unwrap();

    match input.trim()
    {
        "1" => "PASS".to_string(),

        _ => "FAIL".to_string(),
    }
}
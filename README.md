# Project grading

This is the grading code for the project.

## Requirements

- All test results can be printed
- The test results can be returned in JSON or plain text format
- The test results can be shown verbosely, including indicating
  to the student what exactly the test tested for, e.g. what
  selectors were used and how they can fix the problem.
  - These verbose results and the test title are rendered with
    context data and a templating system such that, e.g. the
    team nickname can be shown.
- The tests can short-circuit.
  - E.g. when an /event/2 page does not exist,
    all the tests that might depend on that are skipped/failed.
  - The tests can be told to short circuit on first error
    encountered.

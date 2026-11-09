"""Classify the running PF root filter without disclosing rules or changing PF."""

from run import Blocked, pf, require_default_rules


def classify_root_filter(rules):
    if not rules.strip():
        return "PF_ROOT_EMPTY"
    try:
        # Only the root filter is in scope. An empty translation input satisfies
        # the separate translation predicate without reading translation rules.
        require_default_rules(rules, "")
    except Blocked:
        return "PF_ROOT_OTHER"
    return "PF_ROOT_EXPECTED"


def main():
    try:
        status = classify_root_filter(pf("-sr"))
    except (Exception, KeyboardInterrupt):
        # Keep subprocess errors and unexpected output out of the job log.
        status = "PF_ROOT_UNREADABLE"
    print(status)
    return int(status == "PF_ROOT_UNREADABLE")


if __name__ == "__main__":
    raise SystemExit(main())

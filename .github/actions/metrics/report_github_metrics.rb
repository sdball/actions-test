require 'octokit'
require 'rubygems'
require 'date'
require 'json'

def collect_metrics(jobs, tags)
  jobs.map{|job| collect_job_metrics(job, tags)}.compact + \
  collect_workflow_metrics(jobs, tags)
end

def collect_job_metrics(job, tags)
  return nil unless job["status"] == "completed"
  [
    "job_duration",
    job["completed_at"] - job["started_at"],
    tags + ["status:#{job["conclusion"]}", "name:#{job["name"]}"]
  ]
end

def collect_workflow_metrics(jobs, tags)
  start = jobs.min_by{|job| job["started_at"]}["started_at"]
  finish = jobs.max_by{|job| job["completed_at"]}["completed_at"]
  status = jobs.all?{|job| ["success", "skipped"].include? job["conclusion"]} ? "success" : "failure"
  [[
    "workflow_duration",
    finish - start,
    tags + ["status:#{status}"]
  ]]
end

def submit_metrics(metrics, metric_prefix="")
  metrics.each do |metric, value, tags|
    metric = metric_prefix + metric
    puts "#{metric}, #{value}, #{tags}"
  end
end

def prior_jobs(github_client, jobs)
  length = jobs[:total_count].to_i
  finished_jobs = jobs[:jobs].select{|job| !job["conclusion"].nil? }
  while length - jobs[:jobs].length > 0
    length -= jobs[:jobs].length
    jobs = github_client.get(github_client.last_response.rels[:next].href)
    finished_jobs += jobs[:jobs].select{|job| !job["conclusion"].nil? }
  end
  puts "Found #{finished_jobs.count} completed jobs to report out of #{jobs[:total_count]} total jobs"
  finished_jobs
end

def duration_metrics(github_client, repo, run)
  workflow = github_client.get("repos/#{repo}/actions/runs/#{run}")
  tags = ["workflow:#{workflow["name"]}", "project:#{repo}"]
  jobs = prior_jobs(github_client, github_client.get(workflow["jobs_url"]))
  branch = workflow["head_branch"]
  collect_metrics(jobs, tags)
end

repo = ARGV[0].strip
run = ARGV[1].strip
github_client = Octokit::Client.new(:access_token => ENV['OCTOKIT_TOKEN'])

metrics = nil

case ENV['ACTION'].strip
when "job_metrics"
  metrics = duration_metrics(github_client, repo, run)
end

if metrics
  submit_metrics(metrics)
else
  puts "NO METRICS OH NO"
end
